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
        private readonly ILogger<NotificationsController> _logger;
        private static readonly object _lock = new object();

        // uid -> notification (active alarms)
        private static readonly Dictionary<string, NotificationResult> _activeByUid = new();

        public NotificationsController(
            NotificationService notificationService,
            IHubContext<NotificationHub> hubContext,
            ILogger<NotificationsController> logger)
        {
            _notificationService = notificationService;
            _hubContext = hubContext;
            _logger = logger;
        }

        [HttpGet("latest")]
        public ActionResult GetLatestNotification()
        {
            lock (_lock)
            {
                // (호환용) active 중 첫 번째를 반환
                var n = _activeByUid.Values.FirstOrDefault();
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
        }

        [HttpGet("active")]
        public ActionResult GetActiveNotifications()
        {
            lock (_lock)
            {
                var list = _activeByUid.Values
                    .Select(n => new
                    {
                        uid = n.Uid,
                        message = n.Message,
                        color = n.Color,
                        type = n.Type,
                        isRegistered = n.IsRegistered
                    })
                    .ToList();

                return Ok(new { notifications = list });
            }
        }

        public class ConfirmRequest
        {
            public string? uid { get; set; }
            public bool? hideWindow { get; set; }
        }

        [HttpPost("confirm")]
        public ActionResult Confirm([FromBody] ConfirmRequest? request = null)
        {
            lock (_lock)
            {
                // 기본: 전체 clear
                if (request == null || string.IsNullOrWhiteSpace(request.uid))
                {
                    _activeByUid.Clear();
                }
                else
                {
                    _activeByUid.Remove(request.uid.Trim());
                }

                // 기본은 창 닫기. 설정 버튼 같은 케이스는 hideWindow=false로 유지 가능.
                if (request?.hideWindow != false)
                {
                    Form1.HideWindow();
                }

                return Ok(new { success = true });
            }
        }

        public static void UpsertActiveNotification(NotificationResult notification)
        {
            lock (_lock)
            {
                // 등록된 벨만, uid가 있는 경우만 active로 관리
                if (!notification.IsRegistered) return;
                if (string.IsNullOrWhiteSpace(notification.Uid)) return;

                _activeByUid[notification.Uid.Trim()] = notification;
            }
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

                    Form1.ShowNotificationWindow();
                    UpsertActiveNotification(resultByUid);
                    await _hubContext.Clients.All.SendAsync("ReceiveNotification", resultByUid);

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
                    
                    if (isRegisteredBell)
                    {
                        // 등록된 벨인 경우 무조건 창 표시 및 알림창 전환
                        Form1.ShowNotificationWindow();
                        _logger.LogInformation("알림 테스트: 알림창 표시");
                    }
                    
                    // uid 맵에 등록 (등록된 벨만)
                    UpsertActiveNotification(result);
                    
                    // SignalR로 실시간 알림 전송 - 등록된 벨만 전송
                    await _hubContext.Clients.All.SendAsync("ReceiveNotification", result);
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

