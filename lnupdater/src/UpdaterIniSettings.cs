namespace LnUpdater;

/// <summary>
/// LnuploaderFtp 의 upload.ini 와 동일한 [ftp] 섹션을 사용합니다.
/// 클라이언트 런처용으로 [paths] 에 localRoot(동기화 대상 폴더), hostExe 를 둡니다.
/// </summary>
internal sealed class UpdaterIniSettings
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 22;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    /// <summary>SFTP 로그인 홈(WorkingDirectory) 기준 하위 경로 (예: lnsmsacc).</summary>
    public string DestFolder { get; set; } = "";
    /// <summary>원격 destfolder 와 동일한 구조로 받을 로컬 폴더 (기본 c:\lnsmsacc).</summary>
    public string LocalRoot { get; set; } = @"c:\lnsmsacc";
    /// <summary>동기화 후 실행할 exe 파일명.</summary>
    public string HostExeName { get; set; } = "CareReceiverAgent.Host.exe";

    public static UpdaterIniSettings Load(string iniPath)
    {
        if (!File.Exists(iniPath))
            throw new FileNotFoundException($"INI 파일을 찾을 수 없습니다: {iniPath}");

        var dict = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        string? section = null;

        foreach (var raw in File.ReadAllLines(iniPath, System.Text.Encoding.UTF8))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("#", StringComparison.Ordinal) || line.StartsWith(";", StringComparison.Ordinal))
                continue;

            if (line.StartsWith("[", StringComparison.Ordinal) && line.EndsWith("]", StringComparison.Ordinal))
            {
                section = line.Substring(1, line.Length - 2).Trim();
                if (!dict.ContainsKey(section))
                    dict[section] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                continue;
            }

            var eq = line.IndexOf('=');
            if (eq <= 0 || section == null) continue;
            var key = line.Substring(0, eq).Trim();
            var val = line.Substring(eq + 1).Trim();
            if (val.StartsWith("\"") && val.EndsWith("\"") && val.Length >= 2)
                val = val.Substring(1, val.Length - 2);
            dict[section][key] = val;
        }

        string Get(string sec, string key, string def = "")
        {
            if (!dict.TryGetValue(sec, out var s)) return def;
            return s.TryGetValue(key, out var v) ? v : def;
        }

        var portStr = Get("ftp", "port", "22");
        if (!int.TryParse(portStr, out var port) || port < 1 || port > 65535)
            port = 22;

        var localRoot = Get("paths", "localRoot", "").Trim();
        if (string.IsNullOrEmpty(localRoot))
            localRoot = @"c:\lnsmsacc";

        var hostExe = Get("paths", "hostExe", "CareReceiverAgent.Host.exe").Trim();
        if (string.IsNullOrEmpty(hostExe))
            hostExe = "CareReceiverAgent.Host.exe";

        return new UpdaterIniSettings
        {
            Host = Get("ftp", "host", "").Trim(),
            Port = port,
            User = Get("ftp", "user", "").Trim(),
            Password = Get("ftp", "password", ""),
            DestFolder = Get("ftp", "destfolder", "").Trim(),
            LocalRoot = Path.GetFullPath(localRoot),
            HostExeName = hostExe,
        };
    }
}
