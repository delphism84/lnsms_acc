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

        [HttpGet("app")]
        public ActionResult GetApp()
        {
            var cfg = AppRuntimeConfig.Load();
            return Ok(new { title = cfg.Title, notificationTitle = cfg.NotificationTitle, systemNotifyCallTelText = cfg.SystemNotifyCallTelText });
        }

        public class SaveAppRequest
        {
            public string? Title { get; set; }
            public string? NotificationTitle { get; set; }
            public string? SystemNotifyCallTelText { get; set; }
        }

        [HttpPost("app")]
        public ActionResult SaveApp([FromBody] SaveAppRequest? req)
        {
            try
            {
                var cfg = AppRuntimeConfig.Load();
                if (req != null)
                {
                    if (req.Title != null) cfg.Title = req.Title;
                    if (req.NotificationTitle != null) cfg.NotificationTitle = req.NotificationTitle;
                    if (req.SystemNotifyCallTelText != null) cfg.SystemNotifyCallTelText = req.SystemNotifyCallTelText;
                }
                AppRuntimeConfig.Save(cfg);
                return Ok(new { success = true });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}

