using System.Collections.Generic;
using System.Linq;
using CareReceiverAgent.Host.Models;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsApplyController : ControllerBase
    {
        private readonly NotificationService _notificationService;
        private readonly SerialPortManagerService _serialManager;

        public SettingsApplyController(NotificationService notificationService, SerialPortManagerService serialManager)
        {
            _notificationService = notificationService;
            _serialManager = serialManager;
        }

        /// <summary>
        /// 세트 설정 일괄 적용 (다운로드한 설정으로 에이전트 덮어쓰기). setid.md 규격.
        /// body: { setid?, phrases: [], serial: { ports: [] } }. 적용 후 activeSetId 저장 → COM RX 시 이 설정 기준 알림.
        /// </summary>
        [HttpPost]
        public ActionResult Apply([FromBody] SettingsApplyRequest? request)
        {
            if (request == null)
                return BadRequest(new { success = false, message = "body 필요" });

            try
            {
                if (request.Phrases != null && request.Phrases.Count > 0)
                {
                    var database = new PhraseDatabase();
                    database.Phrases = request.Phrases.Select(p => new PhraseModel
                    {
                        Uid = p.Uid ?? System.Guid.NewGuid().ToString(),
                        Text = p.Text ?? "",
                        IsEnabled = p.IsEnabled,
                        Color = p.Color ?? "#FF0000",
                        BellCodes = p.BellCodes ?? new List<string>(),
                        AutoCloseEnabled = p.AutoCloseEnabled,
                        AutoCloseSeconds = p.AutoCloseSeconds > 0 ? p.AutoCloseSeconds : 10,
                        ImageUrl = string.IsNullOrWhiteSpace(p.Image) ? p.ImageUrl : p.Image,
                        MakerId = p.MakerId,
                        ModelId = p.ModelId
                    }).ToList();
                    JsonDatabaseService.SavePhrases(database);
                    _notificationService.ReloadDatabase();
                }

                if (request.Serial != null && request.Serial.Ports != null)
                {
                    var settings = new SerialSettings { Ports = request.Serial.Ports };
                    JsonDatabaseService.SaveSerialSettings(settings);
                    foreach (var entry in settings.Ports.Where(e => e.AutoConnect))
                        _serialManager.Connect(entry);
                }

                if (!string.IsNullOrWhiteSpace(request.Setid))
                    JsonDatabaseService.SaveActiveSetId(request.Setid.Trim());

                return Ok(new { success = true });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("active-setid")]
        public ActionResult GetActiveSetId()
        {
            var setid = JsonDatabaseService.LoadActiveSetId();
            return Ok(new { activeSetId = setid ?? "" });
        }
    }

    public class SettingsApplyRequest
    {
        public string? Setid { get; set; }
        public List<PhraseApplyItem>? Phrases { get; set; }
        public SerialApplyItem? Serial { get; set; }
    }

    /// <summary>setid.md: image = 파일명. ImageUrl 호환.</summary>
    public class PhraseApplyItem
    {
        public string? Uid { get; set; }
        public string? Text { get; set; }
        public bool IsEnabled { get; set; } = true;
        public string? Color { get; set; }
        public List<string>? BellCodes { get; set; }
        public bool AutoCloseEnabled { get; set; }
        public int AutoCloseSeconds { get; set; } = 10;
        public string? Image { get; set; }
        public string? ImageUrl { get; set; }
        public string? MakerId { get; set; }
        public string? ModelId { get; set; }
    }

    public class SerialApplyItem
    {
        public List<SerialPortEntry>? Ports { get; set; }
    }
}
