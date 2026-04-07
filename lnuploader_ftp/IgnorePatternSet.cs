using DotNet.Globbing;

namespace LnuploaderFtp;

/// <summary>
/// upload.ignore 등에 정의된 glob 패턴(제외 목록). 경로는 로컬 루트 기준 슬래시(/) 구분.
/// </summary>
internal sealed class IgnorePatternSet
{
    private readonly Glob[] _globs;

    private IgnorePatternSet(Glob[] globs)
    {
        _globs = globs;
    }

    public static IgnorePatternSet FromPatterns(IEnumerable<string> patternLines)
    {
        var list = new List<Glob>();
        foreach (var raw in patternLines)
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("#", StringComparison.Ordinal))
                continue;
            try
            {
                list.Add(Glob.Parse(line));
            }
            catch
            {
                // 잘못된 패턴은 건너뜀
            }
        }
        return new IgnorePatternSet(list.ToArray());
    }

    public int Count => _globs.Length;

    /// <param name="relativePath">로컬 루트 기준 상대 경로 (슬래시 구분).</param>
    public bool IsIgnored(string relativePath)
    {
        var n = relativePath.Replace('\\', '/').TrimStart('/');
        foreach (var g in _globs)
        {
            if (g.IsMatch(n))
                return true;
        }
        return false;
    }
}
