using System.Text;

namespace LnuploaderFtp;

internal static class IgnoreFileLoader
{
    /// <summary>INI에 ignoreFile이 없을 때 upload.ignore 이 없으면 사용하는 기본 제외(glob).</summary>
    public static readonly string[] DefaultIgnorePatterns =
    {
        "# 기본 제외 (upload.ignore 파일이 없을 때만 적용)",
        "*.pdb",
        "*.log",
        "*.tmp",
        "*.cache",
        "*.bak",
        "*.swp",
        "**/log/**",
        "**/logs/**",
        "**/obj/**",
        "**/bin/**",
        "**/node_modules/**",
        "**/.git/**",
        ".DS_Store",
        "Thumbs.db",
        "desktop.ini",
    };

    /// <param name="ignoreFileToken">INI의 ignoreFile. none/- 이면 필터 끔. 빈 문자열이면 upload.ignore 사용.</param>
    public static IgnorePatternSet? Load(string iniDirectory, string ignoreFileToken)
    {
        var token = (ignoreFileToken ?? "").Trim();
        if (token.Equals("none", StringComparison.OrdinalIgnoreCase) ||
            token.Equals("-", StringComparison.OrdinalIgnoreCase))
            return null;

        var name = string.IsNullOrEmpty(token) ? "upload.ignore" : token;
        var path = Path.IsPathRooted(name)
            ? name
            : Path.Combine(iniDirectory, name);

        if (File.Exists(path))
        {
            var lines = File.ReadAllLines(path, Encoding.UTF8);
            return IgnorePatternSet.FromPatterns(lines);
        }

        Console.WriteLine($"upload.ignore 없음 → 기본 제외 패턴 사용: {path}");
        return IgnorePatternSet.FromPatterns(DefaultIgnorePatterns);
    }
}
