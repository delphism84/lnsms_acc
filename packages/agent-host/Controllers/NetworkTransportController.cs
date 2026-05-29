using CareReceiverAgent.Host.Models;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/network-transport")]
    public class NetworkTransportController : ControllerBase
    {
        private readonly NetworkTransportBackgroundService _networkTransport;

        public NetworkTransportController(NetworkTransportBackgroundService networkTransport)
        {
            _networkTransport = networkTransport;
        }

        [HttpGet("settings")]
        public ActionResult GetSettings()
        {
            return Ok(JsonDatabaseService.LoadNetworkTransportSettings());
        }

        [HttpPost("settings")]
        public ActionResult SaveSettings([FromBody] NetworkTransportSettings? body)
        {
            if (body?.Links == null)
                return BadRequest(new { success = false, message = "links 배열이 필요합니다." });

            JsonDatabaseService.SaveNetworkTransportSettings(body);
            _networkTransport.RequestReloadSettings();
            return Ok(new { success = true, settings = JsonDatabaseService.LoadNetworkTransportSettings() });
        }
    }
}
