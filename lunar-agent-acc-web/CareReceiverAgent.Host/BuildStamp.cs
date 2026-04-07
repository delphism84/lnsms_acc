namespace CareReceiverAgent.Host;

/// <summary>
/// 빌드 시 생성되는 partial(<c>CompiledUtc</c>, <c>SourceCommitIso</c>)과 짝을 이룹니다.
/// </summary>
internal static partial class BuildStamp
{
    /// <summary>작업 표시줄/트레이용(짧게). 최대 길이 넘으면 잘라냅니다.</summary>
    internal static string FormatTrayText(string baseTitle, int maxLen = 63)
    {
        var b = string.IsNullOrWhiteSpace(baseTitle) ? "장애인도움요청" : baseTitle.Trim();
        var stamp = string.IsNullOrWhiteSpace(SourceCommitIso)
            ? CompiledUtc
            : SourceCommitIso;
        var s = $"{b} · {stamp}";
        return s.Length <= maxLen ? s : s[..maxLen];
    }

    /// <summary>창 제목: 소스(마지막 커밋 ISO 시각) + 컴파일 UTC.</summary>
    internal static string FormatWindowTitle(string baseTitle)
    {
        var b = string.IsNullOrWhiteSpace(baseTitle) ? "장애인도움요청" : baseTitle.Trim();
        if (string.IsNullOrWhiteSpace(SourceCommitIso))
            return $"{b}  [빌드 {CompiledUtc}]";
        return $"{b}  [소스 {SourceCommitIso} · 빌드 {CompiledUtc}]";
    }
}
