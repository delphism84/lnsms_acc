using CareReceiverAgent.Backend.Models;
using CareReceiverAgent.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Backend.Controllers
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
            
            return BadRequest(new { success = false, message = "시리얼 포트 연결 실패" });
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
    }
}

