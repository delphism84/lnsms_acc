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
        private readonly object _handshakeLock = new object();
        private CancellationTokenSource? _seedFallbackCts;
        private bool _allowLegacyBellDecrypt;
        /// <summary>펌웨어 기본·테스트 시드 등. <see cref="TryLegacyBellDecryptForBell"/>에서만 사용.</summary>
        private static readonly ushort[] LegacyBellDecryptSeeds = { 0x1234, 0x0000 };

        /// <summary>
        /// 장애인 진동벨이 보내는 v4 암호 페이로드(32hex) — 세션 시드 없이 복호화 불가할 때 assist(기본 문구)로 필백합니다.
        /// </summary>
        private static readonly System.Collections.Generic.HashSet<string> VibrationBellAssistHex32 =
            new(System.StringComparer.OrdinalIgnoreCase)
            {
                "828b94ad008e5dbffd920f6576df1859",
            };

        public event EventHandler<string>? DataReceived;
        public event EventHandler<bool>? ConnectionStatusChanged;

        public bool IsConnected => _serialPort?.IsOpen ?? false;
        public string? PortName { get; private set; }
        public int BaudRate { get; private set; }
        public bool SecureEnabled { get; private set; }
        public ushort? SessionSeed { get; private set; }
        /// <summary>연결 시 적용된 레거시 벨 복호화 플래그(로그·진단용).</summary>
        public bool LegacyBellDecryptEnabled => _allowLegacyBellDecrypt;
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

        public bool Connect(string portName, int baudRate = 9600, bool secureEnabled = false, string? deviceSerialNumber = null, bool allowLegacyBellDecrypt = false)
        {
            LastConnectError = null;
            Disconnect();

            PortName = portName;
            BaudRate = baudRate;
            SecureEnabled = secureEnabled;
            _allowLegacyBellDecrypt = allowLegacyBellDecrypt;
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

                    // 보안: ReadThread가 TX보다 먼저 .ok를 받으면 TryHandleSerialOk가 SessionSeed 없이 실행되는 레이스를 막기 위해
                    // 시드·마크 생성은 반드시 ReadThread 시작 및 SendCommand보다 앞에 둔다.
                    if (SecureEnabled)
                    {
                        SessionSeed = SecureSerialCodec.GenerateSessionSeed();
                        _pendingSeedMark = SecureSerialCodec.MakeSeedMarkString(SessionSeed.Value);
                    }

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
                        if (_deviceSerialHint != "00000000")
                        {
                            SendSessionSeedMark(_deviceSerialHint, _pendingSeedMark!);
                            _pendingSeedMark = null;
                            CurrentSerialNumber = _deviceSerialHint;
                        }
                        else
                        {
                            // 시리얼 미설정(00000000) 시 .ok 수신 후에만 시드를 보냄. .ok 누락·지연 시 모듈은 이전/기본 시드로 암호화해 PC 복호화가 실패함 → 짧은 지연 후 1회 폴백 전송
                            try
                            {
                                _seedFallbackCts?.Cancel();
                                _seedFallbackCts?.Dispose();
                                _seedFallbackCts = CancellationTokenSource.CreateLinkedTokenSource(_cancellationTokenSource.Token);
                                var ct = _seedFallbackCts.Token;
                                var hint = _deviceSerialHint;
                                _ = Task.Run(async () =>
                                {
                                    try
                                    {
                                        await Task.Delay(900, ct).ConfigureAwait(false);
                                        if (ct.IsCancellationRequested) return;
                                        string? mark;
                                        lock (_handshakeLock)
                                        {
                                            if (string.IsNullOrEmpty(_pendingSeedMark)) return;
                                            if (_serialPort?.IsOpen != true) return;
                                            mark = _pendingSeedMark;
                                            _pendingSeedMark = null;
                                        }
                                        WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] 시드 전송(폴백): 통신체크 .ok 지연/미수신으로 시드 재동기화 시도");
                                        SendSessionSeedMark(hint, mark);
                                    }
                                    catch (OperationCanceledException) { }
                                }, ct);
                            }
                            catch { }
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

                WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] 포트 연결: {portName} ({BaudRate} baud), deviceSerialHint={_deviceSerialHint}, secure={SecureEnabled}, legacyBellDecrypt={_allowLegacyBellDecrypt}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"로그 파일 초기화 실패: {ex.Message}");
            }
        }
        
        /// <summary>
        /// 벨 등록/암호화 분석용 — <c>log_*.txt</c>에 <c>[벨분석]</c> 접두로 기록합니다.
        /// </summary>
        public void WriteBellAnalysisLog(string detail)
        {
            if (!_loggingEnabled || _logWriter == null) return;
            WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] [벨분석] {detail}");
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

                try
                {
                    _seedFallbackCts?.Cancel();
                    _seedFallbackCts?.Dispose();
                    _seedFallbackCts = null;
                }
                catch { }
                
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
                _allowLegacyBellDecrypt = false;
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
                    System.Diagnostics.Debug.WriteLine($"시리얼 수신 오류: {ex.Message}");
                    Thread.Sleep(100);
                }
            }
        }

        private void ProcessReceivedBytes(byte[] data)
        {
            if (data == null || data.Length == 0) return;
            // 라인(\r) 조립 전, 포트에서 읽은 원본 바이트 그대로 (분할 수신 추적용)
            WriteLogFrame("RX-chunk", data);
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
            // v4 암호화 라인(32hex)이면 복호화 시도 + [벨분석] 로그
            if (TryGetV4HexPayload(line, out var encPrefix, out var hex32))
            {
                if (SessionSeed.HasValue)
                {
                    var decoded = SecureSerialCodec.TryDecryptLine(line, SessionSeed.Value);
                    if (!string.IsNullOrEmpty(decoded))
                    {
                        WriteBellAnalysisLog(
                            $"암호화프레임 복호화 성공 Port={PortName} secure={SecureEnabled} 평문={SanitizeForBellLog(decoded)}");
                        return decoded;
                    }

                    var legacy = TryLegacyBellDecryptForBell(line);
                    if (!string.IsNullOrEmpty(legacy))
                        return legacy;

                    if (VibrationBellAssistHex32.Contains(hex32))
                    {
                        var plain = $"{encPrefix}.assist";
                        WriteBellAnalysisLog(
                            $"장애인진동벨 기본필백(hex 일치, 세션복호 실패 후) → assist Port={PortName} hex32={hex32} 평문={plain}");
                        return plain;
                    }

                    WriteBellAnalysisLog(
                        $"암호화프레임 복호화 실패 Port={PortName} prefix={encPrefix} SessionSeed=0x{SessionSeed.Value:x4} hex32={hex32} " +
                        $"legacyBellDecrypt={_allowLegacyBellDecrypt} " +
                        (_allowLegacyBellDecrypt
                            ? "(세션 실패 후 0x1234·0x0000 시도했으나 bell= 미매칭)"
                            : "(레거시 미시도 — 연결 시 legacyBellDecrypt=false 또는 저장된 설정만 사용됨)"));
                    return line;
                }

                var legacyNoSeed = TryLegacyBellDecryptForBell(line);
                if (!string.IsNullOrEmpty(legacyNoSeed))
                    return legacyNoSeed;

                if (VibrationBellAssistHex32.Contains(hex32))
                {
                    var plain = $"{encPrefix}.assist";
                    WriteBellAnalysisLog(
                        $"장애인진동벨 기본필백(hex 일치) → 평문으로 치환 Port={PortName} prefix={encPrefix} hex32={hex32} 평문={plain}");
                    return plain;
                }

                WriteBellAnalysisLog(
                    $"암호화프레임 수신했으나 SessionSeed 없음 Port={PortName} secure={SecureEnabled} legacyBellDecrypt={_allowLegacyBellDecrypt} " +
                    $"prefix={encPrefix} hex32앞12={hex32[..Math.Min(12, hex32.Length)]}…");
                return line;
            }

            // 그 외: "<prefix>.<32hex>"가 아니어도 시드가 있으면 TryDecryptLine (호환)
            if (SessionSeed.HasValue)
            {
                var decoded = SecureSerialCodec.TryDecryptLine(line, SessionSeed.Value);
                if (!string.IsNullOrEmpty(decoded))
                    return decoded;
            }

            return line;
        }

        /// <summary>
        /// 세션 시드와 무관하게(옵션 켠 경우만) 레거시 시드로 복호화 — 평문이 <c>*.bell=</c> 일 때만 채택.
        /// </summary>
        private string? TryLegacyBellDecryptForBell(string line)
        {
            if (!_allowLegacyBellDecrypt) return null;
            foreach (var seed in LegacyBellDecryptSeeds)
            {
                if (SessionSeed.HasValue && seed == SessionSeed.Value) continue;
                var dec = SecureSerialCodec.TryDecryptLine(line, seed);
                if (string.IsNullOrEmpty(dec) || !PayloadBodyStartsWithBell(dec)) continue;
                WriteBellAnalysisLog(
                    $"레거시시드로 벨프레임만 복호화 성공 Port={PortName} seed=0x{seed:x4} 평문={SanitizeForBellLog(dec)}");
                return dec;
            }
            return null;
        }

        private static bool PayloadBodyStartsWithBell(string decodedLine)
        {
            int d = decodedLine.IndexOf('.');
            var rest = (d >= 0 && d < decodedLine.Length - 1
                ? decodedLine.Substring(d + 1)
                : decodedLine).TrimStart();
            return rest.StartsWith("bell=", StringComparison.OrdinalIgnoreCase);
        }

        private static bool TryGetV4HexPayload(string line, out string prefix, out string hex32)
        {
            prefix = string.Empty;
            hex32 = string.Empty;
            if (string.IsNullOrWhiteSpace(line)) return false;
            int dot = line.IndexOf('.');
            if (dot <= 0 || dot >= line.Length - 1) return false;
            prefix = line.Substring(0, dot).Trim();
            if (string.IsNullOrWhiteSpace(prefix)) return false;
            var payload = line.Substring(dot + 1).Trim();
            if (payload.Length != 32) return false;
            if (!payload.All(IsHexAscii)) return false;
            hex32 = payload;
            return true;
        }

        private static bool IsHexAscii(char c) =>
            (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');

        private static string SanitizeForBellLog(string s, int maxLen = 200)
        {
            if (string.IsNullOrEmpty(s)) return "(empty)";
            var sb = new StringBuilder(Math.Min(s.Length, maxLen) + 8);
            int n = 0;
            foreach (var ch in s)
            {
                if (n >= maxLen) { sb.Append("…"); break; }
                if (ch == '\0') sb.Append("\\0");
                else if (ch < 0x20) sb.Append($"\\x{(int)ch:x2}");
                else if (ch == '\r') sb.Append("\\r");
                else if (ch == '\n') sb.Append("\\n");
                else sb.Append(ch);
                n++;
            }
            return sb.ToString();
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
            // "<sn>.ok" — 실제 장치는 "00000000\r" 조회 시 "00000000.ok" 로 응답
            int dot = line.IndexOf('.');
            if (dot <= 0) return;
            var prefix = line.Substring(0, dot).Trim();
            var body = line.Substring(dot + 1).Trim();
            if (!body.Equals("ok", StringComparison.OrdinalIgnoreCase)) return;
            if (!IsEightDigits(prefix)) return;

            if (prefix != "00000000")
            {
                if (!string.Equals(CurrentSerialNumber, prefix, StringComparison.Ordinal))
                {
                    CurrentSerialNumber = prefix;
                    WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] device serial detected: {CurrentSerialNumber}");
                }
            }

            if (SecureEnabled && SessionSeed.HasValue && !string.IsNullOrEmpty(_pendingSeedMark))
            {
                string mark;
                lock (_handshakeLock)
                {
                    if (string.IsNullOrEmpty(_pendingSeedMark)) return;
                    mark = _pendingSeedMark;
                    _pendingSeedMark = null;
                }
                SendSessionSeedMark(prefix, mark);
            }
        }

        /// <summary>
        /// v4 프로토콜(&lt;sn&gt;.seed=)과 레퍼런스 펌웨어(secure_fw.c: crcv.seed=)를 모두 만족시키기 위해 동일 마크를 두 줄로 전송합니다.
        /// 일부 모듈은 8자리 접두 시드만 무시하고 기본 시드(예: 0x1234)로 암호화하는 경우가 있습니다.
        /// </summary>
        private void SendSessionSeedMark(string eightDigitSerialPrefix, string mark44)
        {
            SendCommand($"{eightDigitSerialPrefix}.seed={mark44}");
            SendCommand($"crcv.seed={mark44}");
        }

        private void WriteLogFrame(string dir, byte[] bytes)
        {
            if (bytes == null) return;
            var hex = string.Join(" ", bytes.Select(b => b.ToString("x2")));
            var dec = string.Join(",", bytes.Select(b => b.ToString()));
            var ascii = ToPrintableAscii(bytes);
            // 원본 바이트: 공백 구분 hex + 십진 값(동일 순서). ascii는 인쇄 가능 문자 위주 표시.
            WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {dir} len={bytes.Length} ascii=\"{ascii}\" raw_hex={hex} raw_dec={dec}");
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

