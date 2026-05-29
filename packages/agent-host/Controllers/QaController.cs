using System.Net.Http.Json;
using System.Text.Json;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class QaController : ControllerBase
    {
        private readonly SerialPortManagerService _serialPortManager;

        public QaController(SerialPortManagerService serialPortManager)
        {
            _serialPortManager = serialPortManager;
        }

        /// <summary>
        /// QA 검수용 설정·시드된 호출벨 코드 조회 (유저ID, 매장ID, 호출벨 5개 코드)
        /// </summary>
        [HttpGet("config")]
        public ActionResult GetConfig()
        {
            var cfg = AppRuntimeConfig.Load();
            return Ok(new
            {
                qaEnabled = cfg.QaEnabled,
                qaUserId = cfg.QaUserId ?? "qa-user-001",
                qaStoreId = cfg.QaStoreId ?? "qa-store-001",
                qaBellCodes = new[] { "crcv.assist", "qa.1", "qa.2", "qa.3", "qa.4" }
            });
        }

        /// <summary>
        /// QA 검수: 시리얼 RX 이벤트 강제 호출 (호출벨 호출 → BE 연동 검수용)
        /// body.bellCode 예: "qa.1", "qa.2", "crcv.assist"
        /// </summary>
        [HttpPost("simulate-rx")]
        public ActionResult SimulateRx([FromBody] SimulateRxRequest? body)
        {
            var bellCode = (body?.BellCode ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(bellCode))
                return BadRequest(new { success = false, message = "bellCode 필요" });

            var line = $"00000000.bell={bellCode}\r";
            try
            {
                _serialPortManager.SimulateReceivedData(null, line);
                return Ok(new { success = true, bellCode, message = "RX 시뮬레이션 전송됨" });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// QA 봇: LNSMS 로그인 → 세트 다운로드 → 설정 적용 → RX 시뮬레이션 (알림 발생 검증)
        /// POST /api/qa/bot-run
        /// </summary>
        [HttpPost("bot-run")]
        public async Task<ActionResult> BotRunAsync()
        {
            var cfg = AppRuntimeConfig.Load();
            var lnsmsBase = (cfg.LnsmsApiBase ?? "").Trim().TrimEnd('/');
            if (string.IsNullOrEmpty(lnsmsBase))
                return BadRequest(new { success = false, message = "LnsmsApiBase 미설정 (app.json)" });

            var agentBase = $"{Request.Scheme}://{Request.Host.Value?.TrimEnd('/') ?? "http://localhost:58000"}";
            using var http = new HttpClient();
            http.Timeout = TimeSpan.FromSeconds(15);

            try
            {
                // 1) 로그인
                var loginRes = await http.PostAsJsonAsync($"{lnsmsBase}/api/auth/login",
                    new { userid = "admin", userpw = "admin" });
                if (!loginRes.IsSuccessStatusCode)
                    return BadRequest(new { success = false, message = "LNSMS 로그인 실패" });

                var loginBody = await loginRes.Content.ReadFromJsonAsync<JsonElement>();
                if (!loginBody.TryGetProperty("success", out var succ) || !succ.GetBoolean())
                    return BadRequest(new { success = false, message = "LNSMS 로그인 응답 실패" });

                // 2) 세트 목록
                var setsRes = await http.GetAsync($"{lnsmsBase}/api/sets");
                if (!setsRes.IsSuccessStatusCode)
                    return BadRequest(new { success = false, message = "세트 목록 조회 실패" });

                var setsArray = await setsRes.Content.ReadFromJsonAsync<JsonElement>();
                string? setid = null;
                if (setsArray.ValueKind == JsonValueKind.Array && setsArray.GetArrayLength() > 0)
                {
                    var first = setsArray[0];
                    if (first.TryGetProperty("setid", out var sid))
                        setid = sid.GetString();
                }
                if (string.IsNullOrWhiteSpace(setid))
                    return BadRequest(new { success = false, message = "등록된 세트 없음. QA 시드 실행 후 재시도." });

                // 3) 세트 설정 다운로드
                var configRes = await http.GetAsync($"{lnsmsBase}/api/sets/{Uri.EscapeDataString(setid)}/config");
                if (!configRes.IsSuccessStatusCode)
                    return BadRequest(new { success = false, message = "세트 설정 조회 실패" });

                var config = await configRes.Content.ReadFromJsonAsync<JsonElement>();
                var phrasesJson = config.TryGetProperty("phrases", out var p) ? p.GetRawText() : "[]";
                var serialJson = config.TryGetProperty("serial", out var s) ? s.GetRawText() : "{\"ports\":[]}";
                var applyBodyJson = "{\"setid\":" + JsonSerializer.Serialize(setid) + ",\"phrases\":" + phrasesJson + ",\"serial\":" + serialJson + "}";

                // 4) 에이전트에 설정 적용
                var applyContent = new StringContent(applyBodyJson, System.Text.Encoding.UTF8, "application/json");
                var applyRes = await http.PostAsync($"{agentBase}/api/settingsapply", applyContent);
                if (!applyRes.IsSuccessStatusCode)
                {
                    var err = await applyRes.Content.ReadAsStringAsync();
                    return BadRequest(new { success = false, message = "설정 적용 실패: " + err });
                }

                // 5) RX 시뮬레이션 (알림 발생)
                var simRes = await http.PostAsJsonAsync($"{agentBase}/api/qa/simulate-rx", new { bellCode = "crcv.assist" });
                if (!simRes.IsSuccessStatusCode)
                    return BadRequest(new { success = false, message = "RX 시뮬레이션 실패" });

                return Ok(new
                {
                    success = true,
                    message = "봇 완료: 로그인 → 다운로드 → 적용 → RX 시뮬레이션",
                    setid,
                    bellCode = "crcv.assist"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        public class SimulateRxRequest
        {
            public string? BellCode { get; set; }
        }
    }
}
