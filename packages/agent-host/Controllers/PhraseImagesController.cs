using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/phrases/{uid}/image")]
    public class PhraseImagesController : ControllerBase
    {
        private readonly NotificationService _notification;

        public PhraseImagesController(NotificationService notification)
        {
            _notification = notification;
        }

        [HttpPost]
        [RequestSizeLimit(20 * 1024 * 1024)]
        public ActionResult Upload(string uid, IFormFile file)
        {
            if (string.IsNullOrWhiteSpace(uid)) return BadRequest(new { success = false, message = "uid가 필요합니다." });
            if (file == null || file.Length <= 0) return BadRequest(new { success = false, message = "파일이 필요합니다." });

            // 문구 존재 확인
            var db = JsonDatabaseService.LoadPhrases();
            var phrase = db.Phrases.FirstOrDefault(p => p.Uid == uid);
            if (phrase == null) return NotFound(new { success = false, message = "문구(uid)를 찾을 수 없습니다." });

            // 확장자/컨텐츠타입 최소 검증
            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            var allowed = new HashSet<string> { ".png", ".jpg", ".jpeg", ".webp", ".gif" };
            if (string.IsNullOrEmpty(ext) || !allowed.Contains(ext))
            {
                return BadRequest(new { success = false, message = "지원하지 않는 이미지 형식입니다. (png/jpg/jpeg/webp/gif)" });
            }

            var phraseDir = PhraseImageStorage.GetPhraseDir(uid);
            if (!Directory.Exists(phraseDir)) Directory.CreateDirectory(phraseDir);

            // 기존 이미지 삭제(있으면)
            try
            {
                if (!string.IsNullOrWhiteSpace(phrase.ImageUrl) && phrase.ImageUrl.StartsWith("/media/", StringComparison.OrdinalIgnoreCase))
                {
                    // /media/{rel} -> BaseDir\{rel}
                    var rel = phrase.ImageUrl.Substring("/media/".Length).Replace('/', Path.DirectorySeparatorChar);
                    var oldPath = Path.Combine(PhraseImageStorage.BaseDir, rel);
                    if (System.IO.File.Exists(oldPath))
                    {
                        System.IO.File.Delete(oldPath);
                    }
                }
            }
            catch
            {
                // ignore
            }

            var fileName = $"{DateTime.Now:yyyyMMdd_HHmmssfff}{ext}";
            var absPath = Path.Combine(phraseDir, fileName);

            using (var stream = System.IO.File.Create(absPath))
            {
                file.CopyTo(stream);
            }

            // phrase_images/<uid>/<file>
            var relFromBase = Path.GetRelativePath(PhraseImageStorage.BaseDir, absPath);
            var url = PhraseImageStorage.GetMediaUrl(relFromBase);

            phrase.ImageUrl = url;
            phrase.UpdatedAt = DateTime.Now;
            JsonDatabaseService.SavePhrases(db);
            _notification.ReloadDatabase();

            return Ok(new { success = true, imageUrl = url });
        }

        [HttpDelete]
        public ActionResult Remove(string uid)
        {
            var db = JsonDatabaseService.LoadPhrases();
            var phrase = db.Phrases.FirstOrDefault(p => p.Uid == uid);
            if (phrase == null) return NotFound(new { success = false, message = "문구(uid)를 찾을 수 없습니다." });

            try
            {
                if (!string.IsNullOrWhiteSpace(phrase.ImageUrl) && phrase.ImageUrl.StartsWith("/media/", StringComparison.OrdinalIgnoreCase))
                {
                    var rel = phrase.ImageUrl.Substring("/media/".Length).Replace('/', Path.DirectorySeparatorChar);
                    var abs = Path.Combine(PhraseImageStorage.BaseDir, rel);
                    if (System.IO.File.Exists(abs))
                    {
                        System.IO.File.Delete(abs);
                    }
                }
            }
            catch
            {
                // ignore
            }

            phrase.ImageUrl = null;
            phrase.UpdatedAt = DateTime.Now;
            JsonDatabaseService.SavePhrases(db);
            _notification.ReloadDatabase();

            return Ok(new { success = true });
        }
    }
}

