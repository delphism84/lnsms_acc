using System.Text;
using System.Threading;
using CareReceiverAgent.Host.Models;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SerialPortController : ControllerBase
    {
        private readonly SerialPortService _serialPortService;

        public SerialPortController(SerialPortService serialPortService)
        {
            _serialPortService = serialPortService;
        }

        [HttpGet("status")]
        public ActionResult GetStatus()
        {
            return Ok(new
            {
                isConnected = _serialPortService.IsConnected,
                portName = _serialPortService.PortName,
                baudRate = _serialPortService.BaudRate
            });
        }

        [HttpGet("ports")]
        public ActionResult GetAvailablePorts()
        {
            var ports = System.IO.Ports.SerialPort.GetPortNames();
            return Ok(ports);
        }

        [HttpPost("connect")]
        public ActionResult Connect([FromBody] SerialSettings settings)
        {
            var connected = _serialPortService.Connect(settings.PortName, settings.BaudRate);
            
            if (connected)
            {
                JsonDatabaseService.SaveSerialSettings(settings);
                return Ok(new { success = true });
            }
            
            return BadRequest(new { success = false, message = "?�리???�트 ?�결 ?�패" });
        }

        [HttpPost("disconnect")]
        public ActionResult Disconnect()
        {
            _serialPortService.Disconnect();
            return Ok(new { success = true });
        }

        [HttpGet("settings")]
        public ActionResult GetSettings()
        {
            var settings = JsonDatabaseService.LoadSerialSettings();
            return Ok(settings);
        }

        [HttpPost("settings")]
        public ActionResult SaveSettings([FromBody] SerialSettings settings)
        {
            try
            {
                // 설정 저장
                JsonDatabaseService.SaveSerialSettings(settings);
                
                // 연결되어 있으면 재연결
                if (_serialPortService.IsConnected)
                {
                    _serialPortService.Disconnect();
                    Thread.Sleep(500); // 잠시 대기
                }
                
                // 자동 연결이 활성화되어 있으면 연결
                if (settings.AutoConnect)
                {
                    var connected = _serialPortService.Connect(settings.PortName, settings.BaudRate);
                    if (!connected)
                    {
                        return BadRequest(new { success = false, message = "시리얼 포트 연결 실패" });
                    }
                }
                
                return Ok(new { success = true, message = "설정이 저장되었습니다.", isConnected = _serialPortService.IsConnected });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"설정 저장 실패: {ex.Message}" });
            }
        }
        
        [HttpPost("reconnect")]
        public ActionResult Reconnect([FromBody] SerialSettings settings)
        {
            try
            {
                // 연결 해제
                if (_serialPortService.IsConnected)
                {
                    _serialPortService.Disconnect();
                    Thread.Sleep(500); // 잠시 대기
                }
                
                // 재연결
                if (settings.AutoConnect)
                {
                    var connected = _serialPortService.Connect(settings.PortName, settings.BaudRate);
                    if (!connected)
                    {
                        return BadRequest(new { success = false, message = "시리얼 포트 연결 실패" });
                    }
                }
                
                return Ok(new { success = true, isConnected = _serialPortService.IsConnected });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"재연결 실패: {ex.Message}" });
            }
        }
        
        [HttpGet("log/latest")]
        public ActionResult GetLatestLogLine()
        {
            try
            {
                var logFilePath = _serialPortService.GetCurrentLogFilePath();
                if (string.IsNullOrEmpty(logFilePath) || !System.IO.File.Exists(logFilePath))
                {
                    return Ok(new { line = "", timestamp = DateTime.Now });
                }

                // 파일을 읽기 전용 모드로 열어서 마지막 라인만 읽기
                using (var fileStream = new FileStream(logFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var reader = new StreamReader(fileStream, Encoding.UTF8))
                {
                    string? lastLine = null;
                    string? line;
                    while ((line = reader.ReadLine()) != null)
                    {
                        lastLine = line;
                    }
                    
                    return Ok(new { 
                        line = lastLine ?? "", 
                        timestamp = DateTime.Now 
                    });
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
                var logFilePath = _serialPortService.GetCurrentLogFilePath();
                return Ok(new { path = logFilePath ?? "" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"로그 경로 조회 실패: {ex.Message}" });
            }
        }
        
        [HttpPost("log/enable")]
        public ActionResult SetLoggingEnabled([FromBody] bool enabled)
        {
            try
            {
                _serialPortService.LoggingEnabled = enabled;
                return Ok(new { success = true, enabled = enabled });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = $"로그 설정 실패: {ex.Message}" });
            }
        }
    }
}

