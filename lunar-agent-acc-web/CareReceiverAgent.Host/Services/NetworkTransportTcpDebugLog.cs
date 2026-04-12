using System.Globalization;
using System.Net.Sockets;
using System.Text;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// NetworkTransport TCP 디버깅용 파일 로그 (<c>log/log_tcp_yyMMdd.txt</c>). 시리얼 RX와 유사하게 ascii + 공백 구분 HEX 기록.
    /// </summary>
    internal static class NetworkTransportTcpDebugLog
    {
        private static readonly object _lock = new();
        private static StreamWriter? _writer;
        private static string? _currentFilePath;

        private static void EnsureWriterLocked()
        {
            var logDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "log");
            if (!Directory.Exists(logDir))
                Directory.CreateDirectory(logDir);

            var dateStr = DateTime.Now.ToString("yyMMdd", CultureInfo.InvariantCulture);
            var path = Path.GetFullPath(Path.Combine(logDir, $"log_tcp_{dateStr}.txt"));

            if (_writer != null && string.Equals(_currentFilePath, path, StringComparison.OrdinalIgnoreCase))
                return;

            try
            {
                var rotatingFromPrevious = _writer != null && !string.Equals(_currentFilePath, path, StringComparison.OrdinalIgnoreCase);
                _writer?.Dispose();
                var fs = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.Read);
                _writer = new StreamWriter(fs, Encoding.UTF8) { AutoFlush = true };
                _currentFilePath = path;
                if (rotatingFromPrevious)
                    _writer.WriteLine($"[{NowTs()}] [TCP-LOG] 날짜 전환으로 새 로그 파일");
            }
            catch
            {
                _writer = null;
                _currentFilePath = null;
            }
        }

        private static void WriteLine(string line)
        {
            lock (_lock)
            {
                try
                {
                    EnsureWriterLocked();
                    if (_writer == null) return;
                    _writer.WriteLine(line);
                }
                catch
                {
                    /* 로그 실패는 무시 */
                }
            }
        }

        private static string NowTs() => DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);

        public static void LogInvalidConfig(string label, string name, string host, int port)
        {
            WriteLine($"[{NowTs()}] [{label}] 설정 무효 name={name} host={host} port={port}");
        }

        public static void LogConnectAttempt(string label, string name, string host, int port, int attempt)
        {
            WriteLine($"[{NowTs()}] [{label}] 연결 시도 #{attempt} name={name} → {host}:{port}");
        }

        public static void LogConnected(string label, string name, TcpClient client)
        {
            string? local = null;
            string? remote = null;
            try
            {
                local = client.Client?.LocalEndPoint?.ToString();
                remote = client.Client?.RemoteEndPoint?.ToString();
            }
            catch { /* ignore */ }

            WriteLine($"[{NowTs()}] [{label}] 연결 성공 name={name} local={local ?? "?"} remote={remote ?? "?"}");
        }

        public static void LogRemoteClosed(string label, string name)
        {
            WriteLine($"[{NowTs()}] [{label}] 상대 연결 종료(수신 0 또는 스트림 종료) name={name}");
        }

        public static void LogException(string label, string name, Exception ex, string phase)
        {
            WriteLine($"[{NowTs()}] [{label}] 오류 phase={phase} name={name} type={ex.GetType().Name} message={ex.Message}");
        }

        public static void LogReconnectWait(string label, string name, int seconds)
        {
            WriteLine($"[{NowTs()}] [{label}] {seconds}초 후 재연결 예정 name={name}");
        }

        /// <summary>소켓에서 읽은 원시 바이트(청크).</summary>
        public static void LogRxChunk(string label, string name, ReadOnlySpan<byte> data)
        {
            if (data.Length == 0) return;
            var hex = HexSpaceUpper(data);
            var ascii = ToPrintableAscii(data);
            WriteLine($"[{NowTs()}] [{label}] RX-chunk name={name} len={data.Length} ascii=\"{ascii}\" hex={hex}");
        }

        /// <summary>\r 로 구분된 한 줄(개행 제외 본문 바이트).</summary>
        public static void LogRxLineAssembled(string label, string name, ReadOnlySpan<byte> lineWithoutCr)
        {
            if (lineWithoutCr.Length == 0) return;
            var hex = HexSpaceUpper(lineWithoutCr);
            var ascii = ToPrintableAscii(lineWithoutCr);
            WriteLine($"[{NowTs()}] [{label}] RX-line name={name} len={lineWithoutCr.Length} ascii=\"{ascii}\" hex={hex}");
        }

        private static string HexSpaceUpper(ReadOnlySpan<byte> data)
        {
            if (data.Length == 0) return "";
            var sb = new StringBuilder(data.Length * 3);
            for (var i = 0; i < data.Length; i++)
            {
                if (i > 0) sb.Append(' ');
                sb.Append(data[i].ToString("X2", CultureInfo.InvariantCulture));
            }
            return sb.ToString();
        }

        private static string ToPrintableAscii(ReadOnlySpan<byte> bytes)
        {
            var sb = new StringBuilder(bytes.Length);
            foreach (var b in bytes)
            {
                if (b >= 0x20 && b <= 0x7e) sb.Append((char)b);
                else if (b == 0x0d) sb.Append("\\r");
                else if (b == 0x0a) sb.Append("\\n");
                else if (b == 0x09) sb.Append("\\t");
                else sb.Append('.');
            }
            return sb.ToString();
        }
    }
}
