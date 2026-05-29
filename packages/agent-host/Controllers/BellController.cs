using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BellController : ControllerBase
    {
        private static string? _lastDetectedBellCode;
        private static DateTime _lastDetectedTime = DateTime.MinValue;
        private static readonly object _lock = new object();

        [HttpGet("detect")]
        public ActionResult GetDetectedBell()
        {
            lock (_lock)
            {
                // 최근 2초 이내에 감지된 벨 코드만 반환
                if (_lastDetectedBellCode != null && 
                    (DateTime.Now - _lastDetectedTime).TotalSeconds < 2)
                {
                    var code = _lastDetectedBellCode;
                    _lastDetectedBellCode = null; // 한 번만 반환
                    return Ok(new { bellCode = code });
                }
                return Ok(new { bellCode = (string?)null });
            }
        }

        public static void SetDetectedBell(string bellCode)
        {
            lock (_lock)
            {
                _lastDetectedBellCode = bellCode;
                _lastDetectedTime = DateTime.Now;
            }
        }
    }
}

