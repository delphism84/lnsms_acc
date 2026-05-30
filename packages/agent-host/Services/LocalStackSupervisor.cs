using System.Diagnostics;
using System.Net.Http;

namespace CareReceiverAgent.Host.Services;

/// <summary>
/// 로컬 lnsms 스택(mongod, lnsms-be, lnsms-admin-fe) 기동·정리. Supervisor가 띄운 프로세스만 종료합니다.
/// </summary>
public sealed class LocalStackSupervisor : IDisposable
{
    private readonly AppRuntimeConfig _cfg;
    private readonly List<Process> _children = new();
    private readonly object _lock = new();
    private bool _started;

    public static LocalStackSupervisor? Instance { get; private set; }

    private LocalStackSupervisor(AppRuntimeConfig cfg) => _cfg = cfg;

    public static async Task<LocalStackSupervisor> StartAsync(AppRuntimeConfig cfg, CancellationToken ct = default)
    {
        if (!cfg.LocalStackEnabled)
        {
            var noop = new LocalStackSupervisor(cfg);
            Instance = noop;
            return noop;
        }

        var sup = new LocalStackSupervisor(cfg);
        Instance = sup;
        await sup.StartInternalAsync(ct).ConfigureAwait(false);
        return sup;
    }

    private async Task StartInternalAsync(CancellationToken ct)
    {
        if (_started) return;
        _started = true;

        var repoRoot = ResolveRepoRoot();
        var mongoDir = ResolveMongoDataDir(repoRoot);
        Directory.CreateDirectory(mongoDir);

        if (_cfg.KillExistingOnStart)
        {
            KillListenersOnPorts(new[] { _cfg.MongoPort, _cfg.LnsmsBePort, _cfg.LnsmsFePort });
            await Task.Delay(500, ct).ConfigureAwait(false);
        }

        if (string.Equals(_cfg.MongoMode, "external", StringComparison.OrdinalIgnoreCase))
        {
            StartMongo(mongoDir);
            await WaitForTcpPortAsync(_cfg.MongoPort, TimeSpan.FromSeconds(30), ct).ConfigureAwait(false);
        }

        var beDir = Path.Combine(repoRoot, "packages", "lnsms-be");
        var feDir = Path.Combine(repoRoot, "packages", "lnsms-admin-fe");
        if (!Directory.Exists(beDir))
            throw new DirectoryNotFoundException($"lnsms-be not found: {beDir}");
        if (!Directory.Exists(feDir))
            throw new DirectoryNotFoundException($"lnsms-admin-fe not found: {feDir}");

        var mongoUri = string.Equals(_cfg.MongoMode, "external", StringComparison.OrdinalIgnoreCase)
            ? $"mongodb://127.0.0.1:{_cfg.MongoPort}/lnsms"
            : "memory";

        var uploadDir = Path.Combine(repoRoot, "data", "uploads");
        Directory.CreateDirectory(uploadDir);

        StartNode(
            "lnsms-be",
            fileName: FindNodeExe(),
            arguments: $"\"{Path.Combine(beDir, "src", "index.js")}\"",
            workingDirectory: beDir,
            env: new Dictionary<string, string?>
            {
                ["PORT"] = _cfg.LnsmsBePort.ToString(),
                ["MONGODB_URI"] = mongoUri,
                ["LOCAL_GUEST_PASSWORD"] = _cfg.LocalGuestPassword,
                ["UPLOAD_DIR"] = uploadDir,
            });

        var apiBase = _cfg.LnsmsApiBaseLocal.TrimEnd('/');
        StartNpmDev(
            "lnsms-admin-fe",
            workingDirectory: feDir,
            env: new Dictionary<string, string?>
            {
                ["NEXT_PUBLIC_API_URL"] = apiBase,
                ["API_PROXY_TARGET"] = apiBase,
                ["NEXT_PUBLIC_LOCAL_USERID"] = _cfg.Userid,
                ["NEXT_PUBLIC_LOCAL_STORE_ID"] = _cfg.StoreId,
                ["NEXT_PUBLIC_LOCAL_GUEST_PASSWORD"] = _cfg.LocalGuestPassword,
                ["NEXT_PUBLIC_REMOTE_API_URL"] = _cfg.LnsmsApiBaseRemote.TrimEnd('/'),
            });

        await WaitForHttpOkAsync($"{apiBase}/health", TimeSpan.FromSeconds(60), ct).ConfigureAwait(false);
        await WaitForHttpOkAsync(_cfg.LnsmsUiBaseLocal.TrimEnd('/'), TimeSpan.FromSeconds(60), ct).ConfigureAwait(false);

        Console.WriteLine($"[LocalStack] Ready BE={apiBase} FE={_cfg.LnsmsUiBaseLocal} StoreKey={_cfg.Userid}.{_cfg.StoreId}");
    }

    public void Stop()
    {
        lock (_lock)
        {
            foreach (var p in _children.ToList())
            {
                TryStopProcess(p);
            }
            _children.Clear();
            _started = false;
        }
    }

    public void Dispose() => Stop();

    private string ResolveRepoRoot()
    {
        if (!string.IsNullOrWhiteSpace(_cfg.RepoRoot) && Directory.Exists(_cfg.RepoRoot.Trim()))
            return Path.GetFullPath(_cfg.RepoRoot.Trim());

        // exe 기준 상위 탐색 (publish: .../agent-host/bin → monorepo 루트)
        var dir = AppDomain.CurrentDomain.BaseDirectory;
        for (var i = 0; i < 8; i++)
        {
            var packages = Path.Combine(dir, "packages", "lnsms-be");
            if (Directory.Exists(packages))
                return Path.GetFullPath(dir);
            var parent = Directory.GetParent(dir);
            if (parent == null) break;
            dir = parent.FullName;
        }

        throw new InvalidOperationException(
            "repoRoot not set and packages/lnsms-be not found. Set app.json repoRoot.");
    }

    private string ResolveMongoDataDir(string repoRoot)
    {
        if (!string.IsNullOrWhiteSpace(_cfg.MongoDataDir))
            return Path.GetFullPath(_cfg.MongoDataDir.Trim());
        return Path.Combine(repoRoot, "data", "mongo");
    }

    private void StartMongo(string dataDir)
    {
        var mongod = ResolveMongoExe();
        if (string.IsNullOrEmpty(mongod) || !File.Exists(mongod))
        {
            throw new FileNotFoundException(
                "mongod not found. Install MongoDB or set app.json mongoExe to mongod.exe path.");
        }

        var args = $"--dbpath \"{dataDir}\" --port {_cfg.MongoPort}";
        Console.WriteLine($"[LocalStack] mongod {args}");
        StartProcess("mongod", mongod, args, dataDir, null);
    }

    private string? ResolveMongoExe()
    {
        if (!string.IsNullOrWhiteSpace(_cfg.MongoExe) && File.Exists(_cfg.MongoExe.Trim()))
            return Path.GetFullPath(_cfg.MongoExe.Trim());

        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var segment in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = Path.Combine(segment.Trim(), "mongod.exe");
            if (File.Exists(candidate)) return candidate;
        }

        var common = new[]
        {
            @"C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe",
            @"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe",
        };
        return common.FirstOrDefault(File.Exists);
    }

    private static string FindNodeExe()
    {
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var segment in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = Path.Combine(segment.Trim(), "node.exe");
            if (File.Exists(candidate)) return candidate;
        }
        return "node";
    }

    private void StartNode(string label, string fileName, string arguments, string workingDirectory,
        IReadOnlyDictionary<string, string?>? env)
    {
        Console.WriteLine($"[LocalStack] {label}: {fileName} {arguments}");
        StartProcess(label, fileName, arguments, workingDirectory, env);
    }

    private void StartNpmDev(string label, string workingDirectory, IReadOnlyDictionary<string, string?>? env)
    {
        Console.WriteLine($"[LocalStack] {label}: npm run dev ({workingDirectory})");
        StartProcess(label, "cmd.exe", "/c npm run dev", workingDirectory, env);
    }

    private void StartProcess(string label, string fileName, string arguments, string workingDirectory,
        IReadOnlyDictionary<string, string?>? env)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        if (env != null)
        {
            foreach (var kv in env)
            {
                if (kv.Value != null)
                    psi.Environment[kv.Key] = kv.Value;
            }
        }

        var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
        proc.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data))
                Console.WriteLine($"[{label}] {e.Data}");
        };
        proc.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data))
                Console.WriteLine($"[{label}] {e.Data}");
        };

        if (!proc.Start())
            throw new InvalidOperationException($"Failed to start {label}: {fileName}");

        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();

        lock (_lock)
        {
            _children.Add(proc);
        }
    }

    private static void TryStopProcess(Process p)
    {
        try
        {
            if (p.HasExited) return;
            p.Kill(entireProcessTree: true);
            p.WaitForExit(5000);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalStack] stop PID {p.Id}: {ex.Message}");
        }
        finally
        {
            p.Dispose();
        }
    }

    private static void KillListenersOnPorts(IEnumerable<int> ports)
    {
        var portList = string.Join(",", ports.Distinct());
        var script = $@"
$ports = @({portList})
foreach ($port in $ports) {{
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {{
    $pid = $c.OwningProcess
    if ($pid -gt 0) {{
      Write-Host ""[LocalStack] kill port $port PID $pid""
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }}
  }}
}}";
        RunPowerShell(script);
    }

    private static void RunPowerShell(string script)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{script.Replace("\"", "\\\"")}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            p?.WaitForExit(15000);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalStack] port kill failed: {ex.Message}");
        }
    }

    private static async Task WaitForTcpPortAsync(int port, TimeSpan timeout, CancellationToken ct)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                using var client = new System.Net.Sockets.TcpClient();
                await client.ConnectAsync("127.0.0.1", port, ct).ConfigureAwait(false);
                return;
            }
            catch
            {
                await Task.Delay(500, ct).ConfigureAwait(false);
            }
        }

        throw new TimeoutException($"Port {port} not listening within {timeout.TotalSeconds}s");
    }

    private static async Task WaitForHttpOkAsync(string url, TimeSpan timeout, CancellationToken ct)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var response = await http.GetAsync(url, ct).ConfigureAwait(false);
                if (response.IsSuccessStatusCode)
                    return;
            }
            catch
            {
                // retry
            }

            await Task.Delay(1000, ct).ConfigureAwait(false);
        }

        throw new TimeoutException($"HTTP not ready: {url} ({timeout.TotalSeconds}s)");
    }
}
