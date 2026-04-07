using Renci.SshNet;

namespace LnuploaderFtp;

internal static class SftpDirectoryHelper
{
    /// <summary>원격 디렉터리가 없으면 부모부터 재귀 생성 (Unix 슬래시 경로).</summary>
    public static void EnsureDirectory(SftpClient client, string unixPath)
    {
        var p = unixPath.Replace('\\', '/').TrimEnd('/');
        if (string.IsNullOrEmpty(p) || p == "/")
            return;

        if (DirectoryExists(client, p))
            return;

        var parent = GetParentUnixPath(p);
        if (!string.IsNullOrEmpty(parent) && parent != p)
            EnsureDirectory(client, parent);

        if (!DirectoryExists(client, p))
            client.CreateDirectory(p);
    }

    /// <summary>원격 파일 경로의 디렉터리 부분만 반환.</summary>
    public static string GetParentDirectoryForFile(string remoteFileUnix)
    {
        var p = remoteFileUnix.Replace('\\', '/');
        var i = p.LastIndexOf('/');
        if (i <= 0)
            return "";
        return p.Substring(0, i);
    }

    private static bool DirectoryExists(SftpClient client, string unixPath)
    {
        try
        {
            if (!client.Exists(unixPath))
                return false;
            var a = client.GetAttributes(unixPath);
            return a.IsDirectory;
        }
        catch
        {
            return false;
        }
    }

    private static string GetParentUnixPath(string unixPath)
    {
        var i = unixPath.LastIndexOf('/');
        if (i < 0)
            return "";
        if (i == 0)
            return unixPath.Length > 1 ? "/" : "";
        return unixPath.Substring(0, i);
    }
}
