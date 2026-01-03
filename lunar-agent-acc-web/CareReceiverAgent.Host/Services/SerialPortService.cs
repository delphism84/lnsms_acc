using System;
using System.IO;
using System.IO.Ports;
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
        private string _buffer = string.Empty;
        private StreamWriter? _logWriter;
        private string? _currentLogFile;
        private bool _loggingEnabled = true; // 기본값: on
        private readonly object _logLock = new object();

        public event EventHandler<string>? DataReceived;
        public event EventHandler<bool>? ConnectionStatusChanged;

        public bool IsConnected => _serialPort?.IsOpen ?? false;
        public string? PortName { get; private set; }
        public int BaudRate { get; private set; }
        public bool LoggingEnabled 
        { 
            get => _loggingEnabled; 
            set => _loggingEnabled = value; 
        }

        public SerialPortService()
        {
        }

        public bool Connect(string portName, int baudRate = 9600)
        {
            try
            {
                Disconnect();

                PortName = portName;
                BaudRate = baudRate;

                _serialPort = new SerialPort(portName, baudRate, Parity.None, 8, StopBits.One)
                {
                    Encoding = Encoding.UTF8,
                    ReadTimeout = 1000,
                    WriteTimeout = 1000
                };

                _serialPort.Open();

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

                // 통신 체크 명령 전송 (PC -> Care Receiver)
                SendCommand("crcv");

                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"시리얼 포트 연결 실패: {ex.Message}");
                ConnectionStatusChanged?.Invoke(this, false);
                return false;
            }
        }
        
        private void InitializeLogFile(string portName)
        {
            try
            {
                // 로그 디렉토리 생성
                var logDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                if (!Directory.Exists(logDir))
                {
                    Directory.CreateDirectory(logDir);
                }

                // 날짜별 파일명 생성 (comxx_250101.log 형식)
                var dateStr = DateTime.Now.ToString("yyMMdd");
                var fileName = $"{portName.ToLower()}_{dateStr}.log";
                var filePath = Path.Combine(logDir, fileName);

                _currentLogFile = filePath;

                // 파일 스트림 생성 (append 모드)
                var fileStream = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.Read);
                _logWriter = new StreamWriter(fileStream, Encoding.UTF8)
                {
                    AutoFlush = true
                };

                WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] 포트 연결: {portName} ({BaudRate} baud)");
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
            if (PortName == null || _currentLogFile == null) return;

            var currentDateStr = DateTime.Now.ToString("yyMMdd");
            var expectedFileName = $"{PortName.ToLower()}_{currentDateStr}.log";
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
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"시리얼 포트 연결 해제 실패: {ex.Message}");
            }
        }

        public void SendCommand(string command)
        {
            try
            {
                if (_serialPort?.IsOpen == true)
                {
                    // \r만 전송 (\n 제외)
                    _serialPort.Write(command + "\r");
                    // TX 로그 기록
                    WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] TX: {command}");
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
                        string data = _serialPort.ReadExisting();
                        if (!string.IsNullOrEmpty(data))
                        {
                            ProcessReceivedData(data);
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

        private void ProcessReceivedData(string data)
        {
            _buffer += data;

            // \r로만 구분된 완전한 메시지 처리 (\n은 무시)
            while (_buffer.Contains("\r"))
            {
                int crIndex = _buffer.IndexOf('\r');

                if (crIndex >= 0)
                {
                    string line = _buffer.Substring(0, crIndex).Trim();
                    // \r 제거 (뒤에 \n이 있어도 무시)
                    _buffer = _buffer.Substring(crIndex + 1);
                    // \n이 있으면 제거 (버퍼 시작 부분의 \n 제거)
                    _buffer = _buffer.TrimStart('\n');

                    if (!string.IsNullOrEmpty(line))
                    {
                        // RX 로그 기록
                        WriteLog($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] RX: {line}");
                        DataReceived?.Invoke(this, line);
                    }
                }
                else
                {
                    break;
                }
            }
            
            // 버퍼가 너무 크면 초기화 (무한 증가 방지)
            if (_buffer.Length > 4096)
            {
                System.Diagnostics.Debug.WriteLine($"버퍼 크기 초과, 초기화: {_buffer.Length}");
                _buffer = string.Empty;
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
        
        /// <summary>
        /// 테스트용: rx 데이터를 시뮬레이션하여 처리
        /// </summary>
        public void SimulateReceivedData(string data)
        {
            ProcessReceivedData(data);
        }
    }
}

