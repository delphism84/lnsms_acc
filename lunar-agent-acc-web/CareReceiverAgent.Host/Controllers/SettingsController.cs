using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private const string CustomTrayIconFileName = "agent-tray.ico";

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
            return Ok(new
            {
                title = cfg.Title,
                notificationTitle = cfg.NotificationTitle,
                systemNotifyCallTelText = cfg.SystemNotifyCallTelText,
                systemAccessPassword = string.IsNullOrWhiteSpace(cfg.SystemAccessPassword) ? "8206" : cfg.SystemAccessPassword,
                trayIconFileName = string.IsNullOrWhiteSpace(cfg.TrayIconFileName) ? "appicon.ico" : cfg.TrayIconFileName.Trim(),
                serialEncryptionEnabled = cfg.SerialEncryptionEnabled
            });
        }

        public class SaveAppRequest
        {
            public string? Title { get; set; }
            public string? NotificationTitle { get; set; }
            public string? SystemNotifyCallTelText { get; set; }
            public string? SystemAccessPassword { get; set; }
            public bool? SerialEncryptionEnabled { get; set; }
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
                    if (req.SystemAccessPassword != null)
                    {
                        var pw = req.SystemAccessPassword.Trim();
                        cfg.SystemAccessPassword = string.IsNullOrEmpty(pw) ? "8206" : pw;
                    }
                    if (req.SerialEncryptionEnabled.HasValue)
                        cfg.SerialEncryptionEnabled = req.SerialEncryptionEnabled.Value;
                }
                AppRuntimeConfig.Save(cfg);
                return Ok(new { success = true });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>설정 화면 미리보기용. resource 폴더 내 안전한 파일명만 서빙.</summary>
        [HttpGet("tray-icon")]
        public IActionResult GetTrayIcon()
        {
            var cfg = AppRuntimeConfig.Load();
            var name = string.IsNullOrWhiteSpace(cfg.TrayIconFileName) ? "appicon.ico" : cfg.TrayIconFileName.Trim();
            if (!IsSafeTrayIconFileName(name))
                return NotFound();
            var dir = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resource"));
            var full = Path.GetFullPath(Path.Combine(dir, name));
            if (!full.StartsWith(dir, StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(full))
                return NotFound();
            return PhysicalFile(full, "image/x-icon");
        }

        [HttpPost("app/tray-icon")]
        [RequestSizeLimit(1_048_576)]
        public async Task<ActionResult> UploadTrayIcon(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { success = false, message = "파일이 없습니다." });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".ico")
                return BadRequest(new { success = false, message = ".ico 파일만 등록할 수 있습니다." });

            var resDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resource");
            Directory.CreateDirectory(resDir);
            var destPath = Path.Combine(resDir, CustomTrayIconFileName);
            await using (var fs = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
                await file.CopyToAsync(fs);

            var cfg = AppRuntimeConfig.Load();
            cfg.TrayIconFileName = CustomTrayIconFileName;
            AppRuntimeConfig.Save(cfg);
            return Ok(new
            {
                success = true,
                trayIconFileName = CustomTrayIconFileName,
                message = "트레이·창 아이콘 파일을 저장했습니다. 트레이에는 앱을 다시 시작한 뒤 반영됩니다."
            });
        }

        [HttpPost("app/tray-icon/reset")]
        public ActionResult ResetTrayIcon()
        {
            try
            {
                var resDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resource");
                var customPath = Path.Combine(resDir, CustomTrayIconFileName);
                if (System.IO.File.Exists(customPath))
                    System.IO.File.Delete(customPath);

                var cfg = AppRuntimeConfig.Load();
                cfg.TrayIconFileName = "appicon.ico";
                AppRuntimeConfig.Save(cfg);
                return Ok(new
                {
                    success = true,
                    trayIconFileName = cfg.TrayIconFileName,
                    message = "기본 아이콘(resource/appicon.ico)으로 되돌렸습니다. 트레이에는 앱을 다시 시작한 뒤 반영됩니다."
                });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        private static bool IsSafeTrayIconFileName(string name)
        {
            if (string.IsNullOrEmpty(name) || name.Length > 120)
                return false;
            if (name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                return false;
            if (name.Contains("..", StringComparison.Ordinal))
                return false;
            return name.EndsWith(".ico", StringComparison.OrdinalIgnoreCase);
        }
    }
}

