using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using CareReceiverAgent.Host.Models;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;
using System.IO.Ports;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SerialPortController : ControllerBase
    {
        private readonly SerialPortManagerService _manager;

        public SerialPortController(SerialPortManagerService manager)
        {
            _manager = manager;
        }

        /// <summary>
        /// 연결 중인 포트의 로그 경로가 없을 때(미연결·해제 후)에도 디스크의 log/log_*.txt 를 읽을 수 있게 함.
        /// </summary>
        private static string? ResolveLogFilePathForReading(SerialPortManagerService manager)
        {
            var p = manager.GetCurrentLogFilePath();
            if (!string.IsNullOrEmpty(p) && System.IO.File.Exists(p))
                return p;
            var logDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "log");
            if (!Directory.Exists(logDir))
                return null;
            var today = Path.Combine(logDir, $"log_{DateTime.Now:yyMMdd}.txt");
            if (System.IO.File.Exists(today))
                return today;
            var files = Directory.GetFiles(logDir, "log_*.txt");
            if (files.Length == 0)
                return null;
            return files.OrderByDescending(f => System.IO.File.GetLastWriteTimeUtc(f)).First();
        }

        public class SerialSimulateRxRequest
        {
            public string Line { get; set; } = string.Empty;
            public string? PortName { get; set; }
            public bool AppendCarriageReturn { get; set; } = true;
        }

        public class SerialSendRequest
        {
            public string Line { get; set; } = string.Empty;
            public string? PortName { get; set; }
        }

        public class DisconnectRequest
        {
            public string PortName { get; set; } = string.Empty;
        }

        public class RemovePortRequest
        {
            public string? Id { get; set; }
            public string? PortName { get; set; }
        }

        /// <summary>
        /// 포트별 연결 상태 목록
        /// </summary>
        [HttpGet("status")]
        public ActionResult GetStatus()
        {
            var list = _manager.GetStatusAll();
            return Ok(new { ports = list });
        }

        [HttpGet("ports")]
        public ActionResult GetAvailablePorts()
        {
            var ports = SerialPort.GetPortNames();
            return Ok(ports);
        }

        /// <summary>
        /// 단일 포트 연결 (항목이 설정에 없으면 추가 후 연결)
        /// </summary>
        [HttpPost("connect")]
        public ActionResult Connect([FromBody] SerialPortEntry? entry)
        {
            if (entry == null || string.IsNullOrWhiteSpace(entry.PortName))
                return BadRequest(new { success = false, message = "PortName 필요" });
            var settings = JsonDatabaseService.LoadSerialSettings();
            var ports = settings.Ports ?? new List<SerialPortEntry>();
            var existing = ports.FirstOrDefault(p =>
                string.Equals(p.PortName, entry.PortName, StringComparison.OrdinalIgnoreCase) ||
                (p.Id != null && p.Id == entry.Id));
            if (existing == null)
            {
                if (string.IsNullOrWhiteSpace(entry.Id)) entry.Id = Guid.NewGuid().ToString("N");
                ports.Add(entry);
                settings.Ports = ports;
                JsonDatabaseService.SaveSerialSettings(settings);
            }
            else
            {
                var fromUi = entry;
                entry = existing;
                // 저장 없이 "연결"만 눌렀을 때 UI의 보안·레거시·Baud 등이 디스크 설정에 묻히지 않도록 병합
                entry.SecureEnabled = fromUi.SecureEnabled;
                entry.BaudRate = fromUi.BaudRate;
                entry.AutoConnect = fromUi.AutoConnect;
                if (!string.IsNullOrWhiteSpace(fromUi.DeviceSerialNumber))
                    entry.DeviceSerialNumber = fromUi.DeviceSerialNumber.Trim();
                if (fromUi.AllowLegacyBellDecrypt.HasValue)
                    entry.AllowLegacyBellDecrypt = fromUi.AllowLegacyBellDecrypt;
            }
            var connected = _manager.Connect(entry);
            if (connected)
                return Ok(new { success = true, portName = entry.PortName });
            return BadRequest(new { success = false, message = "시리얼 포트 연결 실패" });
        }

        /// <summary>
        /// 단일 포트 연결 해제
        /// </summary>
        [HttpPost("disconnect")]
        public ActionResult Disconnect([FromBody] DisconnectRequest? req)
        {
            var portName = req?.PortName?.Trim();
            if (string.IsNullOrEmpty(portName))
                return BadRequest(new { success = false, message = "PortName 필요" });
            _manager.Disconnect(portName);
            return Ok(new { success = true });
        }

        [HttpGet("settings")]
        public ActionResult GetSettings()
        {
            var settings = JsonDatabaseService.LoadSerialSettings();
            return Ok(settings);
        }

        [HttpPost("settings")]
        public ActionResult SaveSettings([FromBody] SerialSettings? settings)
        {
            try
            {
                if (settings == null) settings = new SerialSettings();
                var ports = settings.Ports ?? new List<SerialPortEntry>();
                JsonDatabaseService.SaveSerialSettings(settings);

                // 기존 연결 중 목록에 없는 포트는 해제
                var current = _manager.GetStatusAll().Select(s => s.PortName).ToList();
                foreach (var p in current)
                {
                    if (!ports.Any(e => string.Equals(e.PortName, p, StringComparison.OrdinalIgnoreCase)))
                        _manager.Disconnect(p);
                }
                // AutoConnect 항목 연결
                foreach (var entry in ports.Where(e => e.AutoConnect))
                {
                    _manager.Connect(entry);
                }
                return Ok(new { success = true, message = "설정이 저장되었습니다.", ports = _manager.GetStatusAll() });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"설정 저장 실패: {ex.Message}" });
            }
        }

        [HttpPost("settings/save-only")]
        public ActionResult SaveSettingsOnly([FromBody] SerialSettings? settings)
        {
            try
            {
                if (settings == null) settings = new SerialSettings();
                JsonDatabaseService.SaveSerialSettings(settings);
                return Ok(new { success = true, message = "설정이 저장되었습니다." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"설정 저장 실패: {ex.Message}" });
            }
        }

        /// <summary>
        /// 수동 COM 추가: 목록에만 추가 (저장), 연결은 하지 않음
        /// </summary>
        [HttpPost("ports")]
        public ActionResult AddPort([FromBody] SerialPortEntry? entry)
        {
            if (entry == null || string.IsNullOrWhiteSpace(entry.PortName))
                return BadRequest(new { success = false, message = "PortName 필요" });
            var settings = JsonDatabaseService.LoadSerialSettings();
            var ports = settings.Ports ?? new List<SerialPortEntry>();
            if (ports.Any(p => string.Equals(p.PortName, entry.PortName, StringComparison.OrdinalIgnoreCase)))
                return BadRequest(new { success = false, message = "이미 등록된 포트입니다." });
            if (string.IsNullOrWhiteSpace(entry.Id)) entry.Id = Guid.NewGuid().ToString("N");
            ports.Add(entry);
            settings.Ports = ports;
            JsonDatabaseService.SaveSerialSettings(settings);
            return Ok(new { success = true, port = entry });
        }

        /// <summary>
        /// 등록된 포트 제거 (연결 해제 후 목록에서 삭제)
        /// </summary>
        [HttpPost("ports/remove")]
        public ActionResult RemovePort([FromBody] RemovePortRequest? req)
        {
            if (req == null || (string.IsNullOrWhiteSpace(req.Id) && string.IsNullOrWhiteSpace(req.PortName)))
                return BadRequest(new { success = false, message = "Id 또는 PortName 필요" });
            var settings = JsonDatabaseService.LoadSerialSettings();
            var ports = (settings.Ports ?? new List<SerialPortEntry>()).ToList();
            SerialPortEntry? toRemove = null;
            if (!string.IsNullOrWhiteSpace(req.PortName))
                toRemove = ports.FirstOrDefault(p => string.Equals(p.PortName, req.PortName, StringComparison.OrdinalIgnoreCase));
            if (toRemove == null && !string.IsNullOrWhiteSpace(req.Id))
                toRemove = ports.FirstOrDefault(p => p.Id == req.Id);
            if (toRemove == null)
                return NotFound(new { success = false, message = "등록된 포트를 찾을 수 없습니다." });
            _manager.Disconnect(toRemove.PortName);
            ports.Remove(toRemove);
            settings.Ports = ports;
            JsonDatabaseService.SaveSerialSettings(settings);
            return Ok(new { success = true });
        }

        [HttpPost("auto-scan")]
        public ActionResult AutoScan([FromBody] SerialPortAutoScanRequest? request = null)
        {
            int baud = request?.BaudRate ?? 9600;
            int timeoutMs = request?.TimeoutMs ?? 400;
            if (timeoutMs < 100) timeoutMs = 100;
            if (timeoutMs > 5000) timeoutMs = 5000;

            var portNames = SerialPort.GetPortNames();
            var results = new List<SerialPortAutoScanResult>();

            foreach (var portName in portNames)
            {
                var r = new SerialPortAutoScanResult { PortName = portName };
                try
                {
                    using var sp = new SerialPort(portName, baud, Parity.None, 8, StopBits.One)
                    {
                        Encoding = Encoding.ASCII,
                        ReadTimeout = timeoutMs,
                        WriteTimeout = timeoutMs,
                        NewLine = "\r"
                    };
                    sp.Open();
                    sp.Write("00000000\r");
                    r.TxOk = true;
                    var line = sp.ReadLine();
                    r.RxLine = line?.Trim();
                    r.RxOk =
                        string.Equals(r.RxLine, "ok", StringComparison.OrdinalIgnoreCase) ||
                        (r.RxLine != null && r.RxLine.EndsWith(".ok", StringComparison.OrdinalIgnoreCase));
                }
                catch (Exception ex)
                {
                    r.Error = ex.Message;
                }
                results.Add(r);
            }

            var okPorts = results.Where(x => x.TxOk && x.RxOk).Select(x => x.PortName).ToList();
            return Ok(new { success = true, okPorts, results });
        }

        /// <summary>
        /// 자동 검색 후 통과한 모든 COM을 등록 목록에 추가 (저장 후 선택적으로 연결)
        /// </summary>
        [HttpPost("auto-scan/add")]
        public ActionResult AutoScanAndAdd([FromBody] SerialPortAutoScanRequest? request = null)
        {
            int baud = request?.BaudRate ?? 9600;
            int timeoutMs = request?.TimeoutMs ?? 400;
            if (timeoutMs < 100) timeoutMs = 100;
            if (timeoutMs > 5000) timeoutMs = 5000;

            var portNames = SerialPort.GetPortNames();
            var results = new List<SerialPortAutoScanResult>();
            foreach (var portName in portNames)
            {
                var r = new SerialPortAutoScanResult { PortName = portName };
                try
                {
                    using var sp = new SerialPort(portName, baud, Parity.None, 8, StopBits.One)
                    {
                        Encoding = Encoding.ASCII,
                        ReadTimeout = timeoutMs,
                        WriteTimeout = timeoutMs,
                        NewLine = "\r"
                    };
                    sp.Open();
                    sp.Write("00000000\r");
                    r.TxOk = true;
                    var line = sp.ReadLine();
                    r.RxLine = line?.Trim();
                    r.RxOk =
                        string.Equals(r.RxLine, "ok", StringComparison.OrdinalIgnoreCase) ||
                        (r.RxLine != null && r.RxLine.EndsWith(".ok", StringComparison.OrdinalIgnoreCase));
                }
                catch (Exception ex)
                {
                    r.Error = ex.Message;
                }
                results.Add(r);
            }

            var okPorts = results.Where(x => x.TxOk && x.RxOk).Select(x => x.PortName).ToList();
            var settings = JsonDatabaseService.LoadSerialSettings();
            var ports = settings.Ports ?? new List<SerialPortEntry>();
            var added = new List<string>();
            foreach (var name in okPorts)
            {
                if (ports.Any(p => string.Equals(p.PortName, name, StringComparison.OrdinalIgnoreCase)))
                    continue;
                ports.Add(new SerialPortEntry
                {
                    Id = Guid.NewGuid().ToString("N"),
                    PortName = name,
                    BaudRate = baud,
                    AutoConnect = true,
                    SecureEnabled = false,
                    AllowLegacyBellDecrypt = true,
                    DeviceSerialNumber = "00000000"
                });
                added.Add(name);
            }
            settings.Ports = ports;
            JsonDatabaseService.SaveSerialSettings(settings);
            return Ok(new { success = true, okPorts, added, results });
        }

        [HttpGet("log/latest")]
        public ActionResult GetLatestLogLine()
        {
            try
            {
                var logFilePath = ResolveLogFilePathForReading(_manager);
                if (string.IsNullOrEmpty(logFilePath) || !System.IO.File.Exists(logFilePath))
                    return Ok(new { line = "", timestamp = DateTime.Now });
                using (var fileStream = new FileStream(logFilePath!, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var reader = new StreamReader(fileStream, Encoding.UTF8))
                {
                    string? lastLine = null;
                    string? line;
                    while ((line = reader.ReadLine()) != null) lastLine = line;
                    return Ok(new { line = lastLine ?? "", timestamp = DateTime.Now });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"로그 읽기 실패: {ex.Message}" });
            }
        }

        [HttpGet("log/path")]
        public ActionResult GetLogFilePath()
        {
            try
            {
                var path = ResolveLogFilePathForReading(_manager);
                return Ok(new { path = path ?? "" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("log/enable")]
        public ActionResult SetLoggingEnabled([FromBody] bool enabled)
        {
            try
            {
                _manager.SetLoggingEnabled(enabled);
                return Ok(new { success = true, enabled });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("simulate-rx")]
        public ActionResult SimulateRx([FromBody] SerialSimulateRxRequest? req)
        {
            try
            {
                var line = req?.Line ?? string.Empty;
                if (req?.AppendCarriageReturn != false) line += "\r";
                _manager.SimulateReceivedData(req?.PortName, line);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"시뮬레이트 실패: {ex.Message}" });
            }
        }

        /// <summary>
        /// 진단/테스트용: 임의 라인을 시리얼로 송신 (\r은 자동 추가됨)
        /// </summary>
        [HttpPost("send")]
        public ActionResult Send([FromBody] SerialSendRequest? req)
        {
            try
            {
                var line = (req?.Line ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(line))
                    return BadRequest(new { success = false, message = "Line 필요" });

                var port = req?.PortName?.Trim();
                if (string.IsNullOrWhiteSpace(port))
                {
                    port = _manager.ConnectedPortNames.FirstOrDefault();
                }
                if (string.IsNullOrWhiteSpace(port))
                {
                    return Conflict(new { success = false, message = "연결된 시리얼 포트가 없습니다." });
                }

                _manager.SendCommand(port!, line);
                return Ok(new { success = true, portName = port });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}
