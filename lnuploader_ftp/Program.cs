using Renci.SshNet;
using Renci.SshNet.Sftp;

namespace LnuploaderFtp;

internal static class Program
{
    /// <summary>원격·로컬 수정 시각 비교 시 초 단위 허용 오차 (SFTP/파일시스템 반올림).</summary>
    private const double RemoteWriteTimeToleranceSeconds = 2.0;

    private static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        UploadLog? sessionLog = null;

        try
        {
            var argv = args.Where(a => !string.Equals(a, "-v", StringComparison.OrdinalIgnoreCase)).ToArray();
            var iniPath = argv.Length > 0 && !string.IsNullOrWhiteSpace(argv[0])
                ? Path.GetFullPath(argv[0])
                : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "upload.ini");

            var cfg = IniSettings.Load(iniPath);
            if (string.IsNullOrWhiteSpace(cfg.Host))
                throw new InvalidOperationException("INI [ftp] host 가 비어 있습니다.");
            if (string.IsNullOrWhiteSpace(cfg.User))
                throw new InvalidOperationException("INI [ftp] user 가 비어 있습니다.");

            var iniDir = Path.GetDirectoryName(iniPath) ?? AppDomain.CurrentDomain.BaseDirectory;
            var localRoot = Path.GetFullPath(Path.IsPathRooted(cfg.LocalFolder)
                ? cfg.LocalFolder
                : Path.Combine(iniDir, cfg.LocalFolder));

            if (!Directory.Exists(localRoot))
                throw new DirectoryNotFoundException($"로컬 업로드 폴더가 없습니다: {localRoot}");

            sessionLog = new UploadLog(iniDir);
            var log = sessionLog;
            log.WriteLine($"INI: {iniPath}");
            log.WriteLine($"로컬 루트: {localRoot}");
            log.WriteLine("전송: SSH.NET (SFTP), FluentFTP/WinSCP 미사용");

            var ignore = IgnoreFileLoader.Load(iniDir, cfg.IgnoreFile);
            if (ignore == null)
                log.WriteLine("제외 목록: 사용 안 함 (전체 업로드)");
            else if (ignore.Count == 0)
                log.WriteLine("제외 목록: 패턴 없음 (전체 업로드)");
            else
                log.WriteLine($"제외 glob: {ignore.Count}개");

            var auth = new PasswordAuthenticationMethod(cfg.User, cfg.Password);
            var conn = new ConnectionInfo(cfg.Host, cfg.Port, cfg.User, auth)
            {
                Timeout = TimeSpan.FromSeconds(120),
            };

            using var client = new SftpClient(conn);
            client.HostKeyReceived += (_, e) => e.CanTrust = true;

            log.WriteLine($"SFTP 연결 시도: {cfg.Host}:{cfg.Port} (user={cfg.User}) …");
            client.Connect();
            log.WriteLine($"SFTP 연결 성공. IsConnected={client.IsConnected}");

            var home = client.WorkingDirectory ?? "/";
            log.WriteLine($"PWD(홈): {home}");

            var remoteRoot = CombineUnderHome(home, cfg.DestFolder);
            log.WriteLine($"원격 루트(홈+destfolder): {remoteRoot}");

            log.WriteLine($"원격 디렉터리 준비: {remoteRoot}");
            SftpDirectoryHelper.EnsureDirectory(client, remoteRoot);

            var (files, skipped) = BuildUploadFileList(localRoot, ignore);
            log.WriteLine($"디스크 파일 수(전체): {files.Count + skipped}, 업로드 대상: {files.Count}, ignore 건너뜀: {skipped}");

            var (ok, unchanged, fail) = UploadFiles(client, localRoot, remoteRoot, files, log);
            log.WriteLine($"요약: 업로드 성공 {ok}개, 건너뜀(원격과 동일) {unchanged}개, 건너뜀(ignore) {skipped}개, 실패 {fail}개");
            log.WriteLine($"로그 파일: {log.LogPath}");

            client.Disconnect();
            return fail > 0 ? 2 : 0;
        }
        catch (Exception ex)
        {
            var msg = ex.Message;
            Console.Error.WriteLine(msg);
            try
            {
                sessionLog?.WriteLine($"[예외] {ex}");
            }
            catch { }

            if (args.Any(a => string.Equals(a, "-v", StringComparison.OrdinalIgnoreCase)))
                Console.Error.WriteLine(ex.ToString());
            return 1;
        }
        finally
        {
            sessionLog?.Dispose();
        }
    }

    private static (List<string> files, int skipped) BuildUploadFileList(string localRoot, IgnorePatternSet? ignore)
    {
        localRoot = Path.GetFullPath(localRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var list = new List<string>();
        var skipped = 0;
        foreach (var file in Directory.EnumerateFiles(localRoot, "*", SearchOption.AllDirectories))
        {
            var rel = GetRelativePathNet48(localRoot, file);
            var relUnix = rel.Replace('\\', '/');
            if (ignore != null && ignore.Count > 0 && ignore.IsIgnored(relUnix))
            {
                skipped++;
                continue;
            }
            list.Add(file);
        }
        return (list, skipped);
    }

    private static (int ok, int unchanged, int fail) UploadFiles(
        SftpClient client,
        string localRoot,
        string remoteRoot,
        List<string> files,
        UploadLog log)
    {
        var ok = 0;
        var unchanged = 0;
        var fail = 0;
        localRoot = Path.GetFullPath(localRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var total = files.Count;

        for (var i = 0; i < files.Count; i++)
        {
            var file = files[i];
            var rel = GetRelativePathNet48(localRoot, file);
            var relUnix = rel.Replace('\\', '/');
            var remoteFile = remoteRoot.TrimEnd('/') + "/" + relUnix.Replace('\\', '/');

            long len = 0;
            try
            {
                len = new FileInfo(file).Length;
            }
            catch { }

            if (!ShouldUploadLocalFile(client, file, remoteFile, out var skipDetail))
            {
                unchanged++;
                log.WriteLine($"[{i + 1}/{total}] 건너뜀(원격과 동일) {relUnix} ({len} bytes) — {skipDetail}");
                continue;
            }

            log.WriteLine($"[{i + 1}/{total}] SFTP 업로드 시작 → {relUnix} ({len} bytes)");
            log.WriteLine($"    원격: {remoteFile}");

            try
            {
                var dir = SftpDirectoryHelper.GetParentDirectoryForFile(remoteFile);
                if (!string.IsNullOrEmpty(dir))
                    SftpDirectoryHelper.EnsureDirectory(client, dir);

                var sw = System.Diagnostics.Stopwatch.StartNew();
                using (var fs = File.OpenRead(file))
                    client.UploadFile(fs, remoteFile);
                sw.Stop();

                ok++;
                log.WriteLine($"[{i + 1}/{total}] SFTP 완료 ({sw.ElapsedMilliseconds} ms) {relUnix}");
            }
            catch (Exception ex)
            {
                fail++;
                log.WriteLine($"[{i + 1}/{total}] SFTP 예외: {relUnix} — {ex.Message}");
            }
        }

        return (ok, unchanged, fail);
    }

    /// <summary>
    /// 원격에 없거나 크기·수정 시각(UTC)이 로컬과 다르면 업로드합니다.
    /// 크기가 같고 수정 시각이 허용 오차 이내면 동일로 간주합니다.
    /// </summary>
    private static bool ShouldUploadLocalFile(SftpClient client, string localPath, string remotePath, out string detailWhenSkip)
    {
        detailWhenSkip = "";
        FileInfo fi;
        try
        {
            fi = new FileInfo(localPath);
        }
        catch
        {
            return true;
        }

        if (!client.Exists(remotePath))
            return true;

        SftpFileAttributes attr;
        try
        {
            attr = client.GetAttributes(remotePath);
        }
        catch
        {
            return true;
        }

        if (attr.IsDirectory)
            return true;

        if (attr.Size != fi.Length)
            return true;

        var localUtc = fi.LastWriteTimeUtc;
        var remoteUtc = attr.LastWriteTimeUtc;
        var deltaSec = Math.Abs((localUtc - remoteUtc).TotalSeconds);
        if (deltaSec <= RemoteWriteTimeToleranceSeconds)
        {
            detailWhenSkip = $"size={attr.Size}, Δt={deltaSec:0.###}s";
            return false;
        }

        return true;
    }

    /// <summary>.NET Framework 4.8 용 상대 경로 (Path.GetRelativePath 대체).</summary>
    private static string GetRelativePathNet48(string baseDir, string fullPath)
    {
        var baseFull = Path.GetFullPath(baseDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                       + Path.DirectorySeparatorChar;
        var pathFull = Path.GetFullPath(fullPath);
        if (!pathFull.StartsWith(baseFull, StringComparison.OrdinalIgnoreCase))
            return pathFull;
        return pathFull.Substring(baseFull.Length);
    }

    /// <summary>SFTP 홈 + destfolder(홈 기준 상대).</summary>
    private static string CombineUnderHome(string home, string destFolder)
    {
        var h = (home ?? "/").TrimEnd('/');
        var seg = (destFolder ?? "").Trim().TrimStart('/');
        if (string.IsNullOrEmpty(seg))
            return h.Length > 0 ? h : "/";
        return h + "/" + seg;
    }
}
