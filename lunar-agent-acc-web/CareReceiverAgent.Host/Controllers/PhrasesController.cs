using CareReceiverAgent.Host.Models;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PhrasesController : ControllerBase
    {
        private readonly NotificationService _notificationService;

        public PhrasesController(NotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        [HttpGet]
        public ActionResult<PhraseDatabase> GetPhrases()
        {
            // 순수 읽기 전용: 파일에서 읽기만 함 (저장 안 함)
            var database = JsonDatabaseService.LoadPhrases();
            // JSON 속성명을 프론트엔드로 맞춤 (camelCase로 변환)
            // Program.cs에서 JsonNamingPolicy.CamelCase가 설정되어 있으므로 직접 반환하면 자동 변환됨
            return Ok(new { phrases = database.Phrases });
        }

        [HttpPost]
        public ActionResult<PhraseModel> CreatePhrase([FromBody] PhraseModel phrase)
        {
            var database = JsonDatabaseService.LoadPhrases();
            
            // 기본 문구 UID는 생성 불가
            const string defaultUid = "90000001";
            if (phrase.Uid == defaultUid)
            {
                return BadRequest(new { success = false, message = "기본 문구는 생성할 수 없습니다." });
            }
            
            // Uid 중복 체크 및 생성
            if (string.IsNullOrEmpty(phrase.Uid))
            {
                string newUid;
                do
                {
                    newUid = Guid.NewGuid().ToString();
                } while (database.Phrases.Any(p => p.Uid == newUid));
                phrase.Uid = newUid;
            }
            else
            {
                if (database.Phrases.Any(p => p.Uid == phrase.Uid))
                {
                    return BadRequest(new { success = false, message = "이미 존재하는 Uid입니다." });
                }
            }
            
            phrase.Id = 0;
            phrase.BellCodes = NormalizeBellCodes(phrase.BellCodes);
            
            // 기본 벨 코드는 다른 문구에 할당 불가
            const string defaultBellCode = "crcv.assist";
            phrase.BellCodes = phrase.BellCodes.Where(code => code != defaultBellCode).ToList();
            
            phrase.CreatedAt = DateTime.Now;
            phrase.UpdatedAt = DateTime.Now;
            
            database.Phrases.Add(phrase);
            JsonDatabaseService.SavePhrases(database);
            _notificationService.ReloadDatabase();
            
            return Ok(phrase);
        }

        [HttpPut("{uid}")]
        public ActionResult<PhraseModel> UpdatePhrase(string uid, [FromBody] PhraseModel phrase)
        {
            var database = JsonDatabaseService.LoadPhrases();
            var existing = database.Phrases.FirstOrDefault(p => p.Uid == uid);
            
            if (existing == null)
            {
                return NotFound();
            }

            const string defaultUid = "90000001";
            const string defaultBellCode = "crcv.assist";
            bool isDefaultPhrase = existing.Uid == defaultUid;

            // 벨 코드 처리
            List<string> bellCodes = NormalizeBellCodes(phrase.BellCodes);
            
            if (isDefaultPhrase)
            {
                // 기본 문구: assist 벨 코드가 없으면 추가
                if (!bellCodes.Contains(defaultBellCode))
                {
                    bellCodes.Add(defaultBellCode);
                }
            }
            else
            {
                // 기본 문구가 아닌 경우: 기본 벨 코드 제거 (다른 문구에 할당 불가)
                bellCodes = bellCodes.Where(code => code != defaultBellCode).ToList();
            }

            existing.Text = phrase.Text;
            existing.IsEnabled = phrase.IsEnabled;
            existing.Color = phrase.Color;
            existing.BellCodes = bellCodes;
            existing.UpdatedAt = DateTime.Now;
            
            JsonDatabaseService.SavePhrases(database);
            _notificationService.ReloadDatabase();
            
            return Ok(existing);
        }
        
        private static List<string> NormalizeBellCodes(List<string>? bellCodes)
        {
            if (bellCodes == null)
            {
                return new List<string>();
            }
            
            return bellCodes
                .Where(code => !string.IsNullOrEmpty(code))
                .Select(code => code!.ToLowerInvariant().Trim())
                .Distinct()
                .ToList();
        }

        [HttpDelete("{uid}")]
        public ActionResult DeletePhrase(string uid)
        {
            var database = JsonDatabaseService.LoadPhrases();
            // Uid로 찾기
            var phrase = database.Phrases.FirstOrDefault(p => p.Uid == uid);
            
            if (phrase == null)
            {
                return NotFound();
            }

            // 기본 문구("crcv.assist" 벨코드)는 삭제 불가
            const string defaultBellCode = "crcv.assist";
            bool isDefaultPhrase = phrase.BellCodes != null && 
                phrase.BellCodes.Any(code => code?.ToLowerInvariant().Trim() == defaultBellCode);
            
            if (isDefaultPhrase)
            {
                return BadRequest(new { error = "불가능 합니다." });
            }

            database.Phrases.Remove(phrase);
            JsonDatabaseService.SavePhrases(database);
            
            // 메모리 캐시 갱신
            _notificationService.ReloadDatabase();
            
            return NoContent();
        }
    }
}

