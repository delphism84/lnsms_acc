using System;
using System.IO;
using System.IO.Ports;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 시리얼 포트 통신 서비스 (백그라운드 스레드)
    /// </summary>
    public class SerialPortService : IDisposable
    {
        private SerialPort? _serialPort;
        private Thread? _readThread;
        private CancellationTokenSource? _cancellationTokenSource;
        private readonly System.Collections.Generic.List<byte> _rxBuffer = new System.Collections.Generic.List<byte>(4096);
        private StreamWriter? _logWriter;
        private string? _currentLogFile;
        private bool _loggingEnabled = true; // 기본값: on
        private readonly object _logLock = new object();
        private string _deviceSerialHint = "00000000";
        private string? _pendingSeedMark;

        public event EventHandler<string>? DataReceived;
        public event EventHandler<bool>? ConnectionStatusChanged;

        public bool IsConnected => _serialPort?.IsOpen ?? false;
        public string? PortName { get; private set; }
        public int BaudRate { get; private set; }
        public bool SecureEnabled { get; private set; }
        public ushort? SessionSeed { get; private set; }
        public string? LastConnectError { get; private set; }
        public string? CurrentSerialNumber { get; private set; }
        public bool LoggingEnabled 
        { 
            get => _loggingEnabled; 
            set => _loggingEnabled = value; 
        }

        public SerialPortService()
        {
        }

        public bool Connect(string portName, int baudRate = 9600, bool secureEnabled = false, string? deviceSerialNumber = null)
        {
            LastConnectError = null;
            Disconnect();

            PortName = portName;
            BaudRate = baudRate;
            SecureEnabled = secureEnabled;
            SessionSeed = null;
            CurrentSerialNumber = null;
            _pendingSeedMark = null;
            _deviceSerialHint = NormalizeSerial(deviceSerialNumber) ?? "00000000";

            // 재오픈 직후 간헐적 실패(잠금/드라이버 지연) 방지를 위해 짧게 재시도
            for (int attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    var sp = new SerialPort(portName, baudRate, Parity.None, 8, StopBits.One)
                    {
                        Encoding = Encoding.ASCII,
                        ReadTimeout = 200,
                        WriteTimeout = 1000
                    };

                    sp.Open();
                    _serialPort = sp;

                    // 로그 파일 초기화
                    InitializeLogFile(portName);

                    _cancellationTokenSource = new CancellationTokenSource();
                    _readThread = new Thread(() => ReadThreadProc(_cancellationTokenSource.Token))
                    {
                        IsBackground = true,
                        Name = "SerialPortReadThread"
                    };
                    _readThread.Start();

                    ConnectionStatusChanged?.Invoke(this, true);

                    // 초기 핸드셰이크
                    // 1) 통신체크: <시리얼> (없으면 "00000000")
                    SendCommand(_deviceSerialHint);
                    // 2) 보안모드: <시리얼>.seed=<mark> (시리얼을 아직 모르면 ok 수신 후 전송)
                    if (SecureEnabled)
                    {
                        SessionSeed = SecureSerialCodec.GenerateSessionSeed();
                        _pendingSeedMark = SecureSerialCodec.MakeSeedMarkString(SessionSeed.Value);
                        if (_deviceSerialHint != "00000000")
                        {
                            SendCommand($"{_deviceSerialHint}.seed={_pendingSeedMark}");
                            _pendingSeedMark = null;
                            CurrentSerialNumber = _deviceSerialHint;
                        }
                    }

                    return true;
                }
                catch (Exception ex)
                {
                    LastConnectError = ex.Message;
                    System.Diagnostics.Debug.WriteLine($"시리얼 포트 연결 실패(attempt {attempt}): {ex.Message}");
                    try { _serialPort?.Dispose(); } catch { }
                    _serialPort = null;
                    ConnectionStatusChanged?.Invoke(this, false);
                    Thread.Sleep(300);
                }
            }

            return false;
        }
        
        private void InitializeLogFile(string portName)
        {
            try
            {
                // 로그 디렉토리 생성
                var logDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "log");
                if (!Directory.Exists(logDir))
                {
                    Directory.CreateDirectory(logDir);
                }

                // 날짜별 파일명 생성 (log_260104.txt 형식)
                var dateStr = DateTime.Now.ToString("yyMMdd");
                var fileName = $"log_{dateStr}.txt";
                var filePath = Path.Combine(logDir, fileName);

                _currentLogFile = filePath;

                // 파일 스트림 생성 (append 모드)
                var fileStream = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.Read);
                _logWriter = new StreamWriter(fileStream, Encoding.UTF8)
                {
                    AutoFlush = true
                };

                WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] 포트 연결: {portName} ({BaudRate} baud), deviceSerialHint={_deviceSerialHint}, secure={SecureEnabled}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"로그 파일 초기화 실패: {ex.Message}");
            }
        }
        
        private void WriteLog(string message)
        {
            if (!_loggingEnabled || _logWriter == null) return;

            lock (_logLock)
            {
                try
                {
                    // 날짜가 변경되었는지 확인하고 파일 전환
                    CheckAndRotateLogFile();
                    
                    _logWriter.WriteLine(message);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"로그 쓰기 실패: {ex.Message}");
                }
            }
        }
        
        private void CheckAndRotateLogFile()
        {
            if (_currentLogFile == null) return;

            var currentDateStr = DateTime.Now.ToString("yyMMdd");
            var expectedFileName = $"log_{currentDateStr}.txt";
            var expectedFilePath = Path.Combine(
                Path.GetDirectoryName(_currentLogFile) ?? AppDomain.CurrentDomain.BaseDirectory,
                expectedFileName);

            // 날짜가 변경되었으면 새 파일로 전환
            if (_currentLogFile != expectedFilePath)
            {
                try
                {
                    _logWriter?.Close();
                    _logWriter?.Dispose();
                    
                    var fileStream = new FileStream(expectedFilePath, FileMode.Append, FileAccess.Write, FileShare.Read);
                    _logWriter = new StreamWriter(fileStream, Encoding.UTF8)
                    {
                        AutoFlush = true
                    };
                    
                    _currentLogFile = expectedFilePath;
                    WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] 로그 파일 전환");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"로그 파일 전환 실패: {ex.Message}");
                }
            }
        }

        public void Disconnect()
        {
            try
            {
                WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] 포트 연결 해제");
                
                _cancellationTokenSource?.Cancel();

                if (_readThread != null && _readThread.IsAlive)
                {
                    _readThread.Join(1000);
                }

                if (_serialPort?.IsOpen == true)
                {
                    _serialPort.Close();
                }

                _serialPort?.Dispose();
                _serialPort = null;

                // 로그 파일 닫기
                _logWriter?.Close();
                _logWriter?.Dispose();
                _logWriter = null;
                _currentLogFile = null;

                ConnectionStatusChanged?.Invoke(this, false);
                SessionSeed = null;
                SecureEnabled = false;
                CurrentSerialNumber = null;
                _pendingSeedMark = null;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"시리얼 포트 연결 해제 실패: {ex.Message}");
            }
        }

        public void UpdateSessionSeedFromMark(string mark44)
        {
            try
            {
                var seed = SecureSerialCodec.DecodeSeedMarkString(mark44);
                SessionSeed = seed;
                SecureEnabled = true;
            }
            catch
            {
                // ignore
            }
        }

        public void SendCommand(string command)
        {
            try
            {
                if (_serialPort?.IsOpen == true)
                {
                    // \r만 전송 (\n 제외)
                    var bytes = Encoding.ASCII.GetBytes((command ?? string.Empty) + "\r");
                    _serialPort.Write(bytes, 0, bytes.Length);
                    WriteLogFrame("TX", bytes);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"명령 전송 실패: {ex.Message}");
                WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] TX ERROR: {ex.Message}");
            }
        }

        private void ReadThreadProc(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested && _serialPort?.IsOpen == true)
            {
                try
                {
                    if (_serialPort.BytesToRead > 0)
                    {
                        int n = _serialPort.BytesToRead;
                        if (n < 1)
                        {
                            Thread.Sleep(5);
                            continue;
                        }
                        byte[] buf = new byte[n];
                        int read = _serialPort.Read(buf, 0, n);
                        if (read > 0)
                        {
                            if (read != buf.Length) buf = buf.Take(read).ToArray();
                            ProcessReceivedBytes(buf);
                        }
                    }
                    else
                    {
                        Thread.Sleep(10);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"?�이???�신 ?�류: {ex.Message}");
                    Thread.Sleep(100);
                }
            }
        }

        private void ProcessReceivedBytes(byte[] data)
        {
            if (data == null || data.Length == 0) return;
            _rxBuffer.AddRange(data);

            // \r로만 구분된 완전한 메시지 처리 (\n은 무시)
            while (true)
            {
                int crIndex = _rxBuffer.IndexOf(0x0d);
                if (crIndex < 0) break;

                var lineBytes = _rxBuffer.Take(crIndex).ToArray();
                // consume [0..crIndex] (including \r)
                _rxBuffer.RemoveRange(0, crIndex + 1);
                // optional \n consume
                while (_rxBuffer.Count > 0 && _rxBuffer[0] == 0x0a) _rxBuffer.RemoveAt(0);

                string line = Encoding.ASCII.GetString(lineBytes).Trim();
                if (!string.IsNullOrEmpty(line))
                {
                    // RX 로그 기록 (ASCII + HEX)
                    var frameBytes = new byte[lineBytes.Length + 1];
                    Array.Copy(lineBytes, 0, frameBytes, 0, lineBytes.Length);
                    frameBytes[frameBytes.Length - 1] = 0x0d; // \r
                    WriteLogFrame("RX", frameBytes);

                    // 신규 프로토콜: <sn>.ok 수신 시 sn 획득 및 seed pending 처리
                    TryHandleSerialOk(line);

                    DataReceived?.Invoke(this, line);
                }
            }
            
            // 버퍼가 너무 크면 초기화 (무한 증가 방지)
            if (_rxBuffer.Count > 4096)
            {
                System.Diagnostics.Debug.WriteLine($"버퍼 크기 초과, 초기화: {_rxBuffer.Count}");
                _rxBuffer.Clear();
            }
        }

        public void Dispose()
        {
            Disconnect();
            _cancellationTokenSource?.Dispose();
            _logWriter?.Dispose();
        }
        
        public string? GetCurrentLogFilePath()
        {
            return _currentLogFile;
        }

        public string NormalizeInboundLine(string line)
        {
            // 보안 모드: "<prefix>.<32hex>" 를 "<prefix>.<plain>" 으로 복호화 시도
            if (SecureEnabled && SessionSeed.HasValue)
            {
                var decoded = SecureSerialCodec.TryDecryptLine(line, SessionSeed.Value);
                if (!string.IsNullOrEmpty(decoded))
                {
                    return decoded;
                }
            }
            return line;
        }
        
        /// <summary>
        /// 테스트용: rx 데이터를 시뮬레이션하여 처리
        /// </summary>
        public void SimulateReceivedData(string data)
        {
            var bytes = Encoding.ASCII.GetBytes(data ?? string.Empty);
            ProcessReceivedBytes(bytes);
        }

        private static string? NormalizeSerial(string? serial)
        {
            var s = (serial ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(s)) return null;
            if (s.Length != 8) return s;
            return s;
        }

        private static bool IsEightDigits(string s)
        {
            if (s.Length != 8) return false;
            for (int i = 0; i < 8; i++)
            {
                if (s[i] < '0' || s[i] > '9') return false;
            }
            return true;
        }

        private void TryHandleSerialOk(string line)
        {
            // "<sn>.ok"
            int dot = line.IndexOf('.');
            if (dot <= 0) return;
            var prefix = line.Substring(0, dot).Trim();
            var body = line.Substring(dot + 1).Trim();
            if (!body.Equals("ok", StringComparison.OrdinalIgnoreCase)) return;
            if (!IsEightDigits(prefix)) return;
            if (prefix == "00000000") return;

            if (!string.Equals(CurrentSerialNumber, prefix, StringComparison.Ordinal))
            {
                CurrentSerialNumber = prefix;
                WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] device serial detected: {CurrentSerialNumber}");
            }

            if (SecureEnabled && SessionSeed.HasValue && !string.IsNullOrEmpty(_pendingSeedMark))
            {
                var mark = _pendingSeedMark;
                _pendingSeedMark = null;
                SendCommand($"{CurrentSerialNumber}.seed={mark}");
            }
        }

        private void WriteLogFrame(string dir, byte[] bytes)
        {
            if (bytes == null) return;
            var hex = string.Join(" ", bytes.Select(b => b.ToString("x2")));
            var ascii = ToPrintableAscii(bytes);
            WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {dir} ascii=\"{ascii}\" hex={hex}");
        }

        private static string ToPrintableAscii(byte[] bytes)
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

