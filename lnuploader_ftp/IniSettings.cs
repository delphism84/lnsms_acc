namespace LnuploaderFtp;

internal sealed class IniSettings
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 21;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
        /// <summary>SFTP 로그인 홈(WorkingDirectory) 기준 하위 경로 (예: lnsmsacc).</summary>
    public string DestFolder { get; set; } = "";
    /// <summary>업로드할 로컬 폴더 (bin\Release\net48 등). 상대 경로는 INI 파일 위치 기준.</summary>
    public string LocalFolder { get; set; } = @"bin\Release\net48";

    /// <summary>제외 glob 목록 파일 (INI와 같은 폴더 기준 상대 경로). none 이면 필터 없이 전체 업로드.</summary>
    public string IgnoreFile { get; set; } = "upload.ignore";

    public static IniSettings Load(string iniPath)
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

        var portStr = Get("ftp", "port", "21");
        if (!int.TryParse(portStr, out var port) || port < 1 || port > 65535)
            port = 21;

        return new IniSettings
        {
            Host = Get("ftp", "host", "").Trim(),
            Port = port,
            User = Get("ftp", "user", "").Trim(),
            Password = Get("ftp", "password", ""),
            DestFolder = Get("ftp", "destfolder", "").Trim(),
            LocalFolder = Get("paths", "localFolder", Get("ftp", "localFolder", @"bin\Release\net48")).Trim(),
            IgnoreFile = Get("paths", "ignoreFile", "upload.ignore").Trim(),
        };
    }
}
