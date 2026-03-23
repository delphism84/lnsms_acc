using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    /// <summary>setid.md: 서버 브로드캐스트 수신 → 로컬 RX 시뮬레이션 (모든 매장에 RF 전파 효과).</summary>
    [ApiController]
    [Route("api/[controller]")]
    public class BroadcastController : ControllerBase
    {
        private readonly SerialPortManagerService _serialManager;

        public BroadcastController(SerialPortManagerService serialManager)
        {
            _serialManager = serialManager;
        }

        /// <summary>
        /// 서버가 브로드캐스트 시 호출. body: { bellCode }. 로컬 RX 파이프라인으로 주입 → 현재 activeSetId 설정 기준 알림.
        /// </summary>
        [HttpPost("receive")]
        public ActionResult Receive([FromBody] BroadcastReceiveRequest? request)
        {
            var bellCode = request?.BellCode?.Trim();
            if (string.IsNullOrEmpty(bellCode))
                return BadRequest(new { success = false, message = "bellCode 필요" });
            try
            {
                var line = $"00000000.bell={bellCode}\r";
                _serialManager.SimulateReceivedData(null, line);
                return Ok(new { success = true, bellCode });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }

    public class BroadcastReceiveRequest
    {
        public string? BellCode { get; set; }
    }
}
