using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        [HttpGet("port")]
        public ActionResult GetPort()
        {
            var settings = PortService.LoadSettings();
            return Ok(new { port = settings.Port, backendUrl = settings.BackendUrl });
        }
    }
}

