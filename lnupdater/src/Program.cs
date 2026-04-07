using System.Diagnostics;
using Renci.SshNet;

namespace LnUpdater;

/// <summary>
/// SFTP 에서 [ftp].destfolder 를 내려받은 뒤 호스트 exe 를 실행하는 클라이언트 런처.
/// 설정은 LnuploaderFtp 의 upload.ini 와 동일한 형식 (추가: [paths] localRoot, hostExe).
/// </summary>
internal static class Program
{
    private const string UpdaterExeName = "LnUpdater.exe";

    private static readonly string? ThisExePath = GetThisExePath();

    private static string? GetThisExePath()
    {
        try
        {
            return Path.GetFullPath(Process.GetCurrentProcess().MainModule?.FileName ?? "");
        }
        catch
        {
            return null;
        }
    }

    private static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        try
        {
            var iniPath = ResolveIniPath(args);
            var cfg = UpdaterIniSettings.Load(iniPath);

            if (string.IsNullOrWhiteSpace(cfg.Host))
                throw new InvalidOperationException("INI [ftp] host 가 비어 있습니다.");
            if (string.IsNullOrWhiteSpace(cfg.User))
                throw new InvalidOperationException("INI [ftp] user 가 비어 있습니다.");
            if (string.IsNullOrWhiteSpace(cfg.DestFolder))
                throw new InvalidOperationException("INI [ftp] destfolder 가 비어 있습니다 (업로드와 동일 경로를 지정하세요).");

            Console.WriteLine($"INI: {iniPath}");
            Console.WriteLine($"로컬 설치 루트: {cfg.LocalRoot}");
            Console.WriteLine($"원격 destfolder: {cfg.DestFolder}");

            Directory.CreateDirectory(cfg.LocalRoot);

            var hostExePath = Path.Combine(cfg.LocalRoot, cfg.HostExeName);

            ForceKillUpdaterAndHost(cfg.HostExeName);

            var stats = SyncFromSftp(cfg);
            Console.WriteLine($"완료: 다운로드 {stats.Downloaded}개, 건너뜀 {stats.Skipped}개, 오류 {stats.Errors}개");

            StartHost(hostExePath);
            return stats.Errors > 0 ? 2 : 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 1;
        }
    }

    /// <summary>첫 인수가 존재하는 ini 경로면 사용. 아니면 exe 옆 upload.ini → update.ini 순.</summary>
    private static string ResolveIniPath(string[] args)
    {
        if (args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]))
        {
            var p = Path.GetFullPath(args[0].Trim('"'));
            if (File.Exists(p))
                return p;
            throw new FileNotFoundException($"INI 파일이 없습니다: {p}");
        }

        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var upload = Path.Combine(baseDir, "upload.ini");
        if (File.Exists(upload))
            return upload;
        var update = Path.Combine(baseDir, "update.ini");
        if (File.Exists(update))
            return update;

        throw new FileNotFoundException(
            $"INI 가 없습니다. exe 와 같은 폴더에 upload.ini 또는 update.ini 를 두거나, 인수로 경로를 지정하세요.\n기준 폴더: {baseDir}");
    }

    /// <summary>
    /// 배포 폴더 갱신 전에 호스트·업데이터 프로세스를 강제 종료합니다(자식 프로세스 포함).
    /// 현재 PID의 LnUpdater는 제외합니다.
    /// </summary>
    private static void ForceKillUpdaterAndHost(string hostExeName)
    {
        var myPid = Process.GetCurrentProcess().Id;
        var hostBase = Path.GetFileNameWithoutExtension(hostExeName);
        var updaterBase = Path.GetFileNameWithoutExtension(UpdaterExeName);

        ForceKillByProcessName(hostBase, excludePid: null);
        ForceKillByProcessName(updaterBase, excludePid: myPid);

        Thread.Sleep(300);
    }

    private static void ForceKillByProcessName(string processNameWithoutExtension, int? excludePid)
    {
        var pids = new List<int>();
        foreach (var p in Process.GetProcessesByName(processNameWithoutExtension))
        {
            try
            {
                if (excludePid.HasValue && p.Id == excludePid.Value)
                    continue;
                pids.Add(p.Id);
            }
            finally
            {
                p.Dispose();
            }
        }

        foreach (var pid in pids)
        {
            try
            {
                Console.WriteLine($"강제 종료: {processNameWithoutExtension}.exe (PID {pid})");
                ForceKillProcessTree(pid);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"프로세스 종료 경고 (PID {pid}): {ex.Message}");
            }
        }
    }

    /// <summary>Windows에서는 taskkill /F /T 로 자식까지 종료합니다.</summary>
    private static void ForceKillProcessTree(int pid)
    {
        if (Environment.OSVersion.Platform != PlatformID.Win32NT)
        {
            try
            {
                using var p = Process.GetProcessById(pid);
                p.Kill();
                p.WaitForExit(30_000);
            }
            catch (ArgumentException)
            {
                // 이미 종료됨
            }
            return;
        }

        using var killer = Process.Start(new ProcessStartInfo
        {
            FileName = "taskkill",
            Arguments = $"/F /T /PID {pid}",
            CreateNoWindow = true,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        });
        killer?.WaitForExit(30_000);
    }

    private static void StartHost(string hostExePath)
    {
        if (!File.Exists(hostExePath))
        {
            Console.WriteLine($"실행 파일 없음: {hostExePath}");
            return;
        }

        var psi = new ProcessStartInfo
        {
            FileName = hostExePath,
            WorkingDirectory = Path.GetDirectoryName(hostExePath) ?? "",
            UseShellExecute = true,
        };
        Process.Start(psi);
        Console.WriteLine($"실행: {hostExePath}");
    }

    private sealed class SyncStats
    {
        public int Downloaded;
        public int Skipped;
        public int Errors;
    }

    private static SyncStats SyncFromSftp(UpdaterIniSettings cfg)
    {
        var stats = new SyncStats();

        var auth = new PasswordAuthenticationMethod(cfg.User, cfg.Password);
        var conn = new ConnectionInfo(cfg.Host, cfg.Port, cfg.User, auth)
        {
            Timeout = TimeSpan.FromSeconds(120),
        };

        using var client = new SftpClient(conn);
        client.HostKeyReceived += (_, e) => e.CanTrust = true;
        client.Connect();
        Console.WriteLine($"SFTP 연결: {cfg.Host}:{cfg.Port} (SSH)");

        var home = client.WorkingDirectory ?? "/";
        var remoteRoot = CombineUnderHome(home, cfg.DestFolder);
        Console.WriteLine($"원격 루트(홈+destfolder): {remoteRoot}");

        if (!client.Exists(remoteRoot))
        {
            throw new InvalidOperationException($"원격 경로가 없습니다: {remoteRoot}");
        }

        var root = NormalizeRemotePath(remoteRoot);

        var queue = new Queue<string>();
        queue.Enqueue(root);

        while (queue.Count > 0)
        {
            var remoteDir = queue.Dequeue();
            IEnumerable<Renci.SshNet.Sftp.ISftpFile> listing;
            try
            {
                listing = client.ListDirectory(remoteDir);
            }
            catch (Exception ex)
            {
                stats.Errors++;
                Console.Error.WriteLine($"원격 목록 실패: {remoteDir} — {ex.Message}");
                continue;
            }

            foreach (var item in listing)
            {
                if (item.Name == "." || item.Name == "..")
                    continue;

                var remotePath = item.FullName;

                if (item.IsDirectory)
                {
                    queue.Enqueue(remotePath);
                    var rel = GetRelativePath(root, remotePath);
                    var localDir = string.IsNullOrEmpty(rel)
                        ? cfg.LocalRoot
                        : Path.Combine(cfg.LocalRoot, ToLocalPath(rel));
                    Directory.CreateDirectory(localDir);
                    continue;
                }

                if (item.IsSymbolicLink)
                    continue;

                var relFile = GetRelativePath(root, remotePath);
                if (string.IsNullOrEmpty(relFile))
                    continue;

                var localFile = Path.Combine(cfg.LocalRoot, ToLocalPath(relFile));

                try
                {
                    if (IsSamePath(localFile, ThisExePath))
                    {
                        Console.WriteLine($"건너뜀(실행 중인 업데이터): {relFile}");
                        stats.Skipped++;
                        continue;
                    }

                    if (!ShouldDownload(item, localFile))
                    {
                        stats.Skipped++;
                        continue;
                    }

                    var dir = Path.GetDirectoryName(localFile);
                    if (!string.IsNullOrEmpty(dir))
                        Directory.CreateDirectory(dir);

                    using (var fs = File.Create(localFile))
                        client.DownloadFile(remotePath, fs);

                    stats.Downloaded++;
                    TryApplyRemoteTimestamp(localFile, item);
                    Console.WriteLine($"받음: {relFile}");
                }
                catch (Exception ex)
                {
                    stats.Errors++;
                    Console.Error.WriteLine($"오류: {relFile} — {ex.Message}");
                }
            }
        }

        client.Disconnect();
        return stats;
    }

    /// <summary>SFTP 홈 + destfolder(홈 기준 상대). LnuploaderFtp 와 동일.</summary>
    private static string CombineUnderHome(string home, string destFolder)
    {
        var h = (home ?? "/").TrimEnd('/');
        var seg = (destFolder ?? "").Trim().TrimStart('/');
        if (string.IsNullOrEmpty(seg))
            return h.Length > 0 ? h : "/";
        return h + "/" + seg;
    }

    private static string NormalizeRemotePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return "/";
        var p = path.Trim().Replace('\\', '/');
        if (!p.StartsWith("/", StringComparison.Ordinal))
            p = "/" + p.TrimStart('/');
        return p;
    }

    private static bool ShouldDownload(Renci.SshNet.Sftp.ISftpFile remote, string localFile)
    {
        if (!File.Exists(localFile))
            return true;

        if (remote.Length >= 0 && new FileInfo(localFile).Length != remote.Length)
            return true;

        try
        {
            var remoteTime = remote.LastWriteTimeUtc;
            var localTime = File.GetLastWriteTimeUtc(localFile);
            if (remoteTime > localTime.AddSeconds(2))
                return true;
        }
        catch
        {
            // 시간 비교 실패 시 크기만 신뢰
        }

        return false;
    }

    private static void TryApplyRemoteTimestamp(string localFile, Renci.SshNet.Sftp.ISftpFile remote)
    {
        try
        {
            File.SetLastWriteTimeUtc(localFile, remote.LastWriteTimeUtc);
        }
        catch
        {
            // 무시
        }
    }

    private static string ToLocalPath(string relativePosix)
    {
        var parts = relativePosix.Trim('/').Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
        return string.Join(Path.DirectorySeparatorChar.ToString(), parts);
    }

    private static bool IsSamePath(string a, string? b)
    {
        if (string.IsNullOrEmpty(b))
            return false;
        return string.Equals(Path.GetFullPath(a), Path.GetFullPath(b), StringComparison.OrdinalIgnoreCase);
    }

    private static string GetRelativePath(string remoteRoot, string remotePath)
    {
        var a = remoteRoot.TrimEnd('/');
        var b = remotePath.TrimEnd('/');
        if (string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
            return string.Empty;

        if (!b.StartsWith(a, StringComparison.OrdinalIgnoreCase))
            return remotePath.TrimStart('/');

        var rest = b.Substring(a.Length).TrimStart('/');
        return rest;
    }
}
