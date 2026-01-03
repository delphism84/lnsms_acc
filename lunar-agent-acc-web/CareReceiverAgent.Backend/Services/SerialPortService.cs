using System;
using System.IO.Ports;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace CareReceiverAgent.Backend.Services
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

        public event EventHandler<string>? DataReceived;
        public event EventHandler<bool>? ConnectionStatusChanged;

        public bool IsConnected => _serialPort?.IsOpen ?? false;
        public string? PortName { get; private set; }
        public int BaudRate { get; private set; }

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
                    Encoding = Encoding.ASCII,
                    ReadTimeout = 1000,
                    WriteTimeout = 1000
                };

                _serialPort.Open();

                _cancellationTokenSource = new CancellationTokenSource();
                _readThread = new Thread(() => ReadThreadProc(_cancellationTokenSource.Token))
                {
                    IsBackground = true,
                    Name = "SerialPortReadThread"
                };
                _readThread.Start();

                ConnectionStatusChanged?.Invoke(this, true);

                // 통신 체크 명령 전송
                SendCommand("crcvWrWn");

                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"시리얼 포트 연결 실패: {ex.Message}");
                ConnectionStatusChanged?.Invoke(this, false);
                return false;
            }
        }

        public void Disconnect()
        {
            try
            {
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
                    _serialPort.WriteLine(command);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"명령 전송 실패: {ex.Message}");
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
                    System.Diagnostics.Debug.WriteLine($"데이터 수신 오류: {ex.Message}");
                    Thread.Sleep(100);
                }
            }
        }

        private void ProcessReceivedData(string data)
        {
            _buffer += data;

            // 줄바꿈으로 구분된 완전한 메시지 처리
            while (_buffer.Contains("\r\n") || _buffer.Contains("\n"))
            {
                string line;
                int newlineIndex = _buffer.IndexOfAny(new[] { '\r', '\n' });

                if (newlineIndex >= 0)
                {
                    line = _buffer.Substring(0, newlineIndex).Trim();
                    _buffer = _buffer.Substring(newlineIndex + 1).TrimStart('\r', '\n');
                }
                else
                {
                    break;
                }

                if (!string.IsNullOrEmpty(line))
                {
                    DataReceived?.Invoke(this, line);
                }
            }
        }

        public void Dispose()
        {
            Disconnect();
            _cancellationTokenSource?.Dispose();
        }
    }
}

