using CareReceiverAgent.Host.Hubs;
using CareReceiverAgent.Host.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using System.Threading.Tasks;

namespace CareReceiverAgent.Host.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly NotificationService _notificationService;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly NotificationQueueService _queue;
        private readonly ILogger<NotificationsController> _logger;

        public NotificationsController(
            NotificationService notificationService,
            IHubContext<NotificationHub> hubContext,
            NotificationQueueService queue,
            ILogger<NotificationsController> logger)
        {
            _notificationService = notificationService;
            _hubContext = hubContext;
            _queue = queue;
            _logger = logger;
        }

        [HttpGet("latest")]
        public ActionResult GetLatestNotification()
        {
            var n = _queue.GetCurrent();
            if (n == null) return Ok(null);
            return Ok(new
            {
                message = n.Message,
                color = n.Color,
                type = n.Type,
                isRegistered = n.IsRegistered,
                uid = n.Uid
            });
        }

        [HttpGet("active")]
        public ActionResult GetActiveNotifications()
        {
            // 큐는 1개씩 표시가 원칙이므로, 현재 1개만 반환(호환을 위해 notifications 배열은 유지)
            var current = _queue.GetCurrent();
            var list = new List<object>();
            if (current != null)
            {
                list.Add(new
                {
                    uid = current.Uid,
                    message = current.Message,
                    color = current.Color,
                    type = current.Type,
                    isRegistered = current.IsRegistered,
                    autoCloseEnabled = current.AutoCloseEnabled,
                    autoCloseSeconds = current.AutoCloseSeconds,
                    imageUrl = current.ImageUrl
                });
            }

            return Ok(new
            {
                notifications = list,
                queueLength = _queue.GetQueueLength()
            });
        }

        public class ConfirmRequest
        {
            public string? uid { get; set; }
            public bool? hideWindow { get; set; }
            public bool? clearAll { get; set; }
        }

        [HttpPost("confirm")]
        public ActionResult Confirm([FromBody] ConfirmRequest? request = null)
        {
            // 기본: "현재 1개"만 confirm (요구사항)
            // clearAll=true일 때만 전체 제거
            _queue.ConfirmAsync(
                    uid: request?.uid,
                    canShowNext: true,
                    hideWindow: request?.hideWindow != false,
                    clearAll: request?.clearAll == true
                )
                .GetAwaiter()
                .GetResult();

            return Ok(new { success = true });
        }

        [HttpPost("test")]
        public async Task<ActionResult> TestNotification([FromBody] TestNotificationRequest? request = null)
        {
            try
            {
                // 1) uid 기반 테스트 (문구가 벨 등록 전이어도 테스트 가능)
                if (!string.IsNullOrWhiteSpace(request?.Uid))
                {
                    var uid = request!.Uid!.Trim();
                    var db = JsonDatabaseService.LoadPhrases();
                    var phrase = db.Phrases.FirstOrDefault(p => p.Uid == uid);
                    if (phrase == null)
                    {
                        return NotFound(new { success = false, error = "해당 uid 문구를 찾을 수 없습니다." });
                    }

                    var resultByUid = new NotificationResult
                    {
                        Message = phrase.Text ?? string.Empty,
                        Color = phrase.Color ?? "#000000",
                        Type = "bell",
                        IsRegistered = true,
                        Uid = phrase.Uid
                    };

                    bool isSettingsView = WindowController.IsSettingsView();
                    bool canShowNow = !isSettingsView;
                    await _queue.EnqueueAsync(resultByUid, canShowNow);

                    return Ok(new { success = true, message = "알림 테스트가 실행되었습니다." });
                }

                // 2) bellCode 기반 테스트 (호환 유지)
                // 요청에서 벨 코드를 받거나, 없으면 기본 문구의 벨 코드 사용
                string testBellCode = request?.BellCode ?? "crcv.assist";

                _logger.LogInformation("알림 테스트 시작: 벨 코드 {BellCode}", testBellCode);

                // 벨 감지 API에 알림 (벨추가 모달에서 사용)
                BellController.SetDetectedBell(testBellCode);

                // 데이터베이스 재로드 (최신 데이터 확인)
                _notificationService.ReloadDatabase();

                // 알림 처리
                var result = _notificationService.ProcessBellCode(testBellCode);
                
                if (result != null && result.IsRegistered)
                {
                    // 등록된 벨인지 확인
                    var phrase = _notificationService.GetPhraseByBellCode(testBellCode);
                    bool isRegisteredBell = phrase != null && phrase.IsEnabled;
                    
                    _logger.LogInformation("알림 테스트: 벨 코드 처리 완료, 등록됨: {IsRegistered}", isRegisteredBell);
                    
                    bool isSettingsView = WindowController.IsSettingsView();
                    bool canShowNow = isRegisteredBell && !isSettingsView;
                    await _queue.EnqueueAsync(result, canShowNow);
                }
                else if (result != null && !result.IsRegistered)
                {
                    _logger.LogWarning("알림 테스트: 등록되지 않은 벨 코드 {BellCode} (알림 전송 안 함)", testBellCode);
                }
                
                _logger.LogInformation("알림 테스트: 완료");
                
                return Ok(new { 
                    success = true, 
                    message = "알림 테스트가 실행되었습니다."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "알림 테스트 실패");
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }
    }

    public class TestNotificationRequest
    {
        public string? Uid { get; set; }
        public string? BellCode { get; set; }
    }
}

