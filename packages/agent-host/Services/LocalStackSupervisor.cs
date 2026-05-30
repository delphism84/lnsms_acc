using System.Diagnostics;
using System.Net.Http;
using System.Net.NetworkInformation;

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
            var killPorts = new[] { _cfg.MongoPort, _cfg.LnsmsBePort, _cfg.LnsmsFePort, _cfg.AgentApiPort };
            KillListenersOnPorts(killPorts);
            await Task.Delay(800, ct).ConfigureAwait(false);
            KillListenersOnPorts(killPorts);
            await WaitForPortsFreeAsync(killPorts, TimeSpan.FromSeconds(15), ct).ConfigureAwait(false);
        }

        var useExternalMongo = string.Equals(_cfg.MongoMode, "external", StringComparison.OrdinalIgnoreCase);
        if (useExternalMongo)
        {
            var mongod = ResolveMongoExe();
            if (mongod == null)
            {
                if (_cfg.MongoFallbackToMemory)
                {
                    Console.WriteLine(
                        "[LocalStack] mongod not found — using MONGODB_URI=memory. " +
                        "Install MongoDB Community Server or set app.json mongoExe for persistent data.");
                    useExternalMongo = false;
                }
                else
                {
                    throw new FileNotFoundException(BuildMongodNotFoundMessage());
                }
            }
            else
            {
                StartMongo(mongoDir, mongod);
                await WaitForTcpPortAsync(_cfg.MongoPort, TimeSpan.FromSeconds(30), ct).ConfigureAwait(false);
            }
        }

        var beDir = Path.Combine(repoRoot, "packages", "lnsms-be");
        var feDir = Path.Combine(repoRoot, "packages", "lnsms-admin-fe");
        if (!Directory.Exists(beDir))
            throw new DirectoryNotFoundException($"lnsms-be not found: {beDir}");
        if (!Directory.Exists(feDir))
            throw new DirectoryNotFoundException($"lnsms-admin-fe not found: {feDir}");

        var mongoUri = useExternalMongo
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

    private void StartMongo(string dataDir, string mongodExe)
    {
        var args = $"--dbpath \"{dataDir}\" --port {_cfg.MongoPort} --bind_ip 127.0.0.1";
        Console.WriteLine($"[LocalStack] {mongodExe} {args}");
        StartProcess("mongod", mongodExe, args, dataDir, null);
    }

    private string BuildMongodNotFoundMessage() =>
        "mongod not found.\r\n" +
        "• Install: https://www.mongodb.com/try/download/community\r\n" +
        "• Or set app.json \"mongoExe\": \"C:\\\\Program Files\\\\MongoDB\\\\Server\\\\8.0\\\\bin\\\\mongod.exe\"\r\n" +
        "• Or set \"mongoMode\": \"memory\" / \"mongoFallbackToMemory\": true";

    private string? ResolveMongoExe()
    {
        if (!string.IsNullOrWhiteSpace(_cfg.MongoExe))
        {
            var configured = _cfg.MongoExe.Trim().Trim('"');
            if (File.Exists(configured))
                return Path.GetFullPath(configured);
        }

        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var segment in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = Path.Combine(segment.Trim(), "mongod.exe");
            if (File.Exists(candidate)) return candidate;
        }

        foreach (var root in new[]
                 {
                     @"C:\Program Files\MongoDB\Server",
                     @"C:\Program Files (x86)\MongoDB\Server",
                 })
        {
            if (!Directory.Exists(root)) continue;
            try
            {
                var newest = Directory.GetDirectories(root)
                    .Select(d => Path.Combine(d, "bin", "mongod.exe"))
                    .Where(File.Exists)
                    .OrderByDescending(p => p, StringComparer.OrdinalIgnoreCase)
                    .FirstOrDefault();
                if (newest != null) return newest;
            }
            catch
            {
                // ignore scan errors
            }
        }

        return null;
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
        // package.json dev 스크립트에 -p 63001 포함 — 중복 -p 시 next가 포트를 두 번 바인딩함
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
        var portList = string.Join(",", ports.Where(p => p > 0).Distinct());
        var script = $@"
$ErrorActionPreference = 'SilentlyContinue'
$ports = @({portList})
foreach ($port in $ports) {{
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object {{ $_.OwningProcess }} |
    Sort-Object -Unique |
    ForEach-Object {{
      if ($_ -gt 0) {{
        Write-Host ""[LocalStack] kill port $port PID $_""
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      }}
    }}
}}";
        RunPowerShell(script);
    }

    private static async Task WaitForPortsFreeAsync(IEnumerable<int> ports, TimeSpan timeout, CancellationToken ct)
    {
        var list = ports.Where(p => p > 0).Distinct().ToList();
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            ct.ThrowIfCancellationRequested();
            if (list.All(p => !IsPortListening(p)))
            {
                Console.WriteLine($"[LocalStack] ports free: {string.Join(", ", list)}");
                return;
            }

            await Task.Delay(400, ct).ConfigureAwait(false);
        }

        var busy = list.Where(IsPortListening).ToList();
        throw new TimeoutException(
            $"Ports still in use after kill: {string.Join(", ", busy)}. Run scripts\\kill-lnsms-ports.ps1");
    }

    private static bool IsPortListening(int port)
    {
        try
        {
            return IPGlobalProperties.GetIPGlobalProperties()
                .GetActiveTcpListeners()
                .Any(ep => ep.Port == port);
        }
        catch
        {
            return false;
        }
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
