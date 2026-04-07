using System.Text;

namespace LnuploaderFtp;

/// <summary>upload_YYYYMMDD.log (INI/실행 폴더) + 콘솔 미러.</summary>
internal sealed class UploadLog : IDisposable
{
    private readonly object _lock = new();
    private readonly StreamWriter? _writer;
    private readonly string _path;
    private bool _disposed;

    public UploadLog(string baseDirectory)
    {
        var dir = Path.GetFullPath(baseDirectory);
        if (!Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        var name = $"upload_{DateTime.Now:yyyyMMdd}.log";
        _path = Path.Combine(dir, name);
        _writer = new StreamWriter(new FileStream(_path, FileMode.Append, FileAccess.Write, FileShare.Read), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false))
        {
            AutoFlush = true,
        };
        WriteLine($"========== 세션 시작 {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} ==========");
    }

    public string LogPath => _path;

    public void WriteLine(string message)
    {
        var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}";
        lock (_lock)
        {
            Console.WriteLine(line);
            try
            {
                _writer?.WriteLine(line);
            }
            catch
            {
                // 로그 실패는 무시
            }
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            WriteLine($"========== 세션 종료 {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} ==========");
        }
        catch { }
        try
        {
            _writer?.Dispose();
        }
        catch { }
    }
}
