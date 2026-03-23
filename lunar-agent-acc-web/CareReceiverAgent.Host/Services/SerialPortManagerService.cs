using System;
using System.Collections.Generic;
using System.Linq;
using CareReceiverAgent.Host.Models;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// RX 이벤트에 포트 정보를 담기 위한 인자
    /// </summary>
    public class SerialPortDataEventArgs : EventArgs
    {
        public string? PortName { get; }
        public string Data { get; }

        public SerialPortDataEventArgs(string? portName, string data)
        {
            PortName = portName;
            Data = data ?? string.Empty;
        }
    }

    /// <summary>
    /// 다중 시리얼 포트 등록·COM별 TX/RX 관리
    /// </summary>
    public class SerialPortManagerService
    {
        private readonly Dictionary<string, SerialPortService> _byPort = new Dictionary<string, SerialPortService>(StringComparer.OrdinalIgnoreCase);
        private readonly object _lock = new object();

        /// <summary>
        /// 어떤 포트에서든 데이터 수신 시 발생 (portName이 null이면 시뮬레이션 등)
        /// </summary>
        public event EventHandler<SerialPortDataEventArgs>? DataReceived;

        /// <summary>
        /// 특정 포트 연결 상태 변경 시 (portName, isConnected)
        /// </summary>
        public event EventHandler<(string PortName, bool IsConnected)>? ConnectionStatusChanged;

        public IReadOnlyList<string> ConnectedPortNames
        {
            get
            {
                lock (_lock)
                {
                    return _byPort.Where(kv => kv.Value.IsConnected).Select(kv => kv.Key).ToList();
                }
            }
        }

        /// <summary>
        /// 지정 포트에 연결
        /// </summary>
        public bool Connect(SerialPortEntry entry)
        {
            if (entry == null || string.IsNullOrWhiteSpace(entry.PortName))
                return false;
            var portName = entry.PortName.Trim();
            lock (_lock)
            {
                if (_byPort.TryGetValue(portName, out var existing))
                {
                    existing.Disconnect();
                    existing.Dispose();
                    _byPort.Remove(portName);
                }

                var svc = new SerialPortService();
                svc.DataReceived += (s, data) =>
                {
                    DataReceived?.Invoke(this, new SerialPortDataEventArgs(portName, data));
                };
                svc.ConnectionStatusChanged += (s, connected) =>
                {
                    ConnectionStatusChanged?.Invoke(this, (portName, connected));
                };

                var ok = svc.Connect(portName, entry.BaudRate, entry.SecureEnabled, entry.DeviceSerialNumber);
                if (ok)
                    _byPort[portName] = svc;
                else
                    svc.Dispose();
                return ok;
            }
        }

        /// <summary>
        /// 지정 포트 연결 해제
        /// </summary>
        public void Disconnect(string portName)
        {
            if (string.IsNullOrWhiteSpace(portName)) return;
            var key = portName.Trim();
            lock (_lock)
            {
                if (_byPort.TryGetValue(key, out var svc))
                {
                    svc.Disconnect();
                    svc.Dispose();
                    _byPort.Remove(key);
                    ConnectionStatusChanged?.Invoke(this, (key, false));
                }
            }
        }

        /// <summary>
        /// 모든 포트 연결 해제
        /// </summary>
        public void DisconnectAll()
        {
            lock (_lock)
            {
                foreach (var kv in _byPort.ToList())
                {
                    kv.Value.Disconnect();
                    kv.Value.Dispose();
                    ConnectionStatusChanged?.Invoke(this, (kv.Key, false));
                }
                _byPort.Clear();
            }
        }

        /// <summary>
        /// 포트별 서비스 조회 (NormalizeInboundLine 등용)
        /// </summary>
        public SerialPortService? GetService(string? portName)
        {
            if (string.IsNullOrWhiteSpace(portName)) return null;
            lock (_lock)
            {
                return _byPort.TryGetValue(portName.Trim(), out var svc) ? svc : null;
            }
        }

        /// <summary>
        /// 포트별 상태 목록 반환
        /// </summary>
        public IReadOnlyList<SerialPortStatusItem> GetStatusAll()
        {
            lock (_lock)
            {
                return _byPort.Select(kv => new SerialPortStatusItem
                {
                    PortName = kv.Key,
                    IsConnected = kv.Value.IsConnected,
                    BaudRate = kv.Value.BaudRate,
                    SecureEnabled = kv.Value.SecureEnabled,
                    CurrentSerialNumber = kv.Value.CurrentSerialNumber,
                    LastError = kv.Value.LastConnectError
                }).ToList();
            }
        }

        /// <summary>
        /// 지정 포트에 TX 전송
        /// </summary>
        public void SendCommand(string portName, string command)
        {
            var svc = GetService(portName);
            svc?.SendCommand(command);
        }

        /// <summary>
        /// 시뮬레이션: RX 데이터 주입. portName이 있으면 해당 포트 서비스에 주입, 없으면 첫 연결 포트 또는 가상 수신(portName=null)으로 이벤트만 발생
        /// </summary>
        public void SimulateReceivedData(string? portName, string data)
        {
            if (!string.IsNullOrWhiteSpace(portName))
            {
                var svc = GetService(portName);
                if (svc != null)
                {
                    svc.SimulateReceivedData(data);
                    return;
                }
            }
            // 연결된 포트가 없거나 portName 미지정: 첫 번째 연결 포트에 주입 시도
            lock (_lock)
            {
                var first = _byPort.Values.FirstOrDefault(s => s.IsConnected);
                if (first != null)
                {
                    first.SimulateReceivedData(data);
                    return;
                }
            }
            // 아무 포트도 연결 안 됨: 알림 파이프라인만 타도록 이벤트만 발생 (QA 등)
            DataReceived?.Invoke(this, new SerialPortDataEventArgs(null, data?.TrimEnd('\r', '\n') ?? string.Empty));
        }

        /// <summary>
        /// 로그 파일 경로: 첫 번째 연결된 포트 기준
        /// </summary>
        public string? GetCurrentLogFilePath()
        {
            lock (_lock)
            {
                var first = _byPort.Values.FirstOrDefault(s => s.IsConnected);
                return first?.GetCurrentLogFilePath();
            }
        }

        public void SetLoggingEnabled(bool enabled)
        {
            lock (_lock)
            {
                foreach (var svc in _byPort.Values)
                    svc.LoggingEnabled = enabled;
            }
        }
    }

    public class SerialPortStatusItem
    {
        public string PortName { get; set; } = string.Empty;
        public bool IsConnected { get; set; }
        public int BaudRate { get; set; }
        public bool SecureEnabled { get; set; }
        public string? CurrentSerialNumber { get; set; }
        public string? LastError { get; set; }
    }
}
