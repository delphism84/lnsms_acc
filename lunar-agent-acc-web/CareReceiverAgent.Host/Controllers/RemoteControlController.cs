using System.Linq;
using System.Text.RegularExpressions;
using CareReceiverAgent.Host.Models;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RemoteControlController : ControllerBase
    {
        private readonly SerialPortManagerService _serialManager;

        public RemoteControlController(SerialPortManagerService serialManager)
        {
            _serialManager = serialManager;
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
            // remotes 누락/바인딩 실패 시 null → 저장하면 파일이 비워져 행이 사라짐
            if (settings?.Remotes == null)
                return BadRequest(new { success = false, message = "remotes 배열이 필요합니다." });

            {
                var codes = settings.Remotes
                    .Where(r => r != null && !string.IsNullOrWhiteSpace(r.BellCode))
                    .Select(r => r.BellCode!.Trim().ToLowerInvariant())
                    .ToList();
                if (codes.Count != codes.Distinct().Count())
                    return BadRequest(new { success = false, message = "같은 벨 코드는 한 리모콘 줄에만 지정할 수 있습니다." });
            }

            JsonDatabaseService.SaveRemoteControlSettings(settings);
            var cfg = JsonDatabaseService.LoadRemoteControlSettings();
            return Ok(new { success = true, settings = cfg });
        }

        public class RemoteTxRequest
        {
            public string? BellCode { get; set; }
            public int? KeyIndex { get; set; }
            public string? RemoteKey { get; set; }
            public string? PortName { get; set; }
        }

        /// <summary>
        /// 리모콘 TX: bellCode(20자리 패딩) + remoteKey(4자리 패딩) 조합을 serial.bell=payload 형식으로 전송.
        /// </summary>
        [HttpPost("tx")]
        public ActionResult SendRemoteTx([FromBody] RemoteTxRequest? req)
        {
            var bell = (req?.BellCode ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(bell))
                return BadRequest(new { success = false, message = "bellCode 필요" });
            if (bell.Length > 20)
                return BadRequest(new { success = false, message = "bellCode는 최대 20자까지 지원합니다." });

            var remoteKeyRaw = (req?.RemoteKey ?? "").Trim();
            if (string.IsNullOrWhiteSpace(remoteKeyRaw))
            {
                var idx = req?.KeyIndex ?? 0;
                if (idx < 1 || idx > 9999) idx = 1;
                remoteKeyRaw = idx.ToString();
            }
            if (!Regex.IsMatch(remoteKeyRaw, "^[0-9A-Za-z]+$"))
                return BadRequest(new { success = false, message = "remoteKey는 영문/숫자만 허용됩니다." });
            if (remoteKeyRaw.Length > 4)
                return BadRequest(new { success = false, message = "remoteKey는 최대 4자입니다." });

            var port = req?.PortName?.Trim();
            if (string.IsNullOrWhiteSpace(port))
                port = _serialManager.ConnectedPortNames.FirstOrDefault();
            if (string.IsNullOrWhiteSpace(port))
                return Conflict(new { success = false, message = "연결된 시리얼 포트가 없습니다." });

            var status = _serialManager.GetStatusAll()
                .FirstOrDefault(s => string.Equals(s.PortName, port, System.StringComparison.OrdinalIgnoreCase));
            var serial = (status?.CurrentSerialNumber ?? "").Trim();
            if (!Regex.IsMatch(serial, "^[0-9]{8}$")) serial = "00000000";

            var payload = bell.PadRight(20, '0') + remoteKeyRaw.PadLeft(4, '0');
            var line = $"{serial}.bell={payload}";
            _serialManager.SendCommand(port!, line);
            return Ok(new { success = true, portName = port, serial, payload, line });
        }
    }
}
