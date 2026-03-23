using System;
using System.Linq;
using CareReceiverAgent.Host.Models;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RemoteControlController : ControllerBase
    {
        private readonly SerialPortManagerService _serial;

        public RemoteControlController(SerialPortManagerService serial)
        {
            _serial = serial;
        }

        public class SaveRequest
        {
            public RemoteControlSettings? Settings { get; set; }
        }

        public class SendRequest
        {
            public int Number { get; set; }
            public string? PortName { get; set; }
        }

        [HttpGet("buttons")]
        public ActionResult GetButtons()
        {
            var cfg = JsonDatabaseService.LoadRemoteControlSettings();
            return Ok(cfg);
        }

        [HttpPost("buttons")]
        public ActionResult SaveButtons([FromBody] RemoteControlSettings? settings)
        {
            JsonDatabaseService.SaveRemoteControlSettings(settings);
            var cfg = JsonDatabaseService.LoadRemoteControlSettings();
            return Ok(new { success = true, settings = cfg });
        }

        [HttpPost("send")]
        public ActionResult Send([FromBody] SendRequest? req)
        {
            if (req == null) return BadRequest(new { success = false, message = "요청이 비어있습니다." });
            if (req.Number < 1 || req.Number > 15) return BadRequest(new { success = false, message = "번호는 1~15 범위여야 합니다." });

            var cfg = JsonDatabaseService.LoadRemoteControlSettings();
            var btn = cfg.Buttons.FirstOrDefault(b => b.Number == req.Number);
            if (btn == null) return NotFound(new { success = false, message = "버튼 설정을 찾을 수 없습니다." });
            var code = (btn.SendCode ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { success = false, message = "발송코드가 비어있습니다." });

            var port = req.PortName?.Trim();
            if (string.IsNullOrWhiteSpace(port))
            {
                port = _serial.ConnectedPortNames.FirstOrDefault();
            }
            if (string.IsNullOrWhiteSpace(port))
            {
                return Conflict(new { success = false, message = "연결된 시리얼 포트가 없습니다." });
            }

            _serial.SendCommand(port!, code);
            return Ok(new { success = true, portName = port, number = req.Number });
        }
    }
}

