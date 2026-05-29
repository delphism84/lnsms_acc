using CareReceiverAgent.Host.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 알림을 1개씩만 표시하기 위한 큐 서비스.
    /// - 설정 화면에서는 "표시"를 하지 않고 큐에만 적재
    /// - 확인(confirm) 시 현재 1개만 제거하고 다음 1개를 표시
    /// </summary>
    public class NotificationQueueService
    {
        private readonly object _lock = new object();
        private readonly IHubContext<NotificationHub> _hub;
        private readonly ILogger<NotificationQueueService> _logger;

        private readonly Queue<NotificationResult> _queue = new();
        private NotificationResult? _current;

        public NotificationQueueService(IHubContext<NotificationHub> hub, ILogger<NotificationQueueService> logger)
        {
            _hub = hub;
            _logger = logger;
        }

        public NotificationResult? GetCurrent()
        {
            lock (_lock) return _current;
        }

        public int GetQueueLength()
        {
            lock (_lock) return _queue.Count;
        }

        public List<NotificationResult> GetSnapshot()
        {
            lock (_lock)
            {
                var list = new List<NotificationResult>();
                if (_current != null) list.Add(_current);
                list.AddRange(_queue);
                return list;
            }
        }

        public async Task EnqueueAsync(NotificationResult n, bool canShowNow)
        {
            if (n == null) return;
            if (!n.IsRegistered) return;
            if (string.IsNullOrWhiteSpace(n.Uid)) return;

            NotificationResult? toShow = null;
            lock (_lock)
            {
                if (_current == null)
                {
                    _current = n;
                    toShow = n;
                }
                else
                {
                    _queue.Enqueue(n);
                }
            }

            if (toShow != null && canShowNow)
            {
                try
                {
                    Form1.ShowNotificationWindow();
                }
                catch { }

                await SafePushAsync(toShow);
            }
            else if (toShow != null)
            {
                // 표시를 하지 않는 경우에도 프론트 폴링은 /active로 확인 가능하므로 push는 생략
                _logger.LogInformation("알림 큐 적재(표시 보류): {Uid}", toShow.Uid);
            }
        }

        public async Task<bool> ConfirmAsync(string? uid, bool canShowNext, bool hideWindow = true, bool clearAll = false)
        {
            NotificationResult? nextToShow = null;
            bool cleared = false;

            lock (_lock)
            {
                if (clearAll)
                {
                    _current = null;
                    _queue.Clear();
                    cleared = true;
                }
                else
                {
                    // uid가 없으면 "현재 1개"만 confirm
                    if (string.IsNullOrWhiteSpace(uid))
                    {
                        if (_current != null)
                        {
                            _current = null;
                            cleared = true;
                        }
                    }
                    else
                    {
                        // 현재가 uid와 같으면 현재만 confirm
                        if (_current != null && string.Equals(_current.Uid?.Trim(), uid.Trim(), StringComparison.Ordinal))
                        {
                            _current = null;
                            cleared = true;
                        }
                        // 큐 내부의 특정 uid 제거는 요구사항 범위 밖이므로 생략(1개씩만 처리)
                    }
                }

                if (_current == null && _queue.Count > 0)
                {
                    _current = _queue.Dequeue();
                    nextToShow = _current;
                }
            }

            if (nextToShow != null && canShowNext)
            {
                try
                {
                    Form1.ShowNotificationWindow();
                }
                catch { }
                await SafePushAsync(nextToShow);
            }
            else if (nextToShow == null && hideWindow)
            {
                try
                {
                    Form1.HideWindow();
                }
                catch { }
            }

            return cleared;
        }

        public async Task TryShowCurrentAsync()
        {
            NotificationResult? cur;
            lock (_lock) cur = _current;
            if (cur == null) return;
            await SafePushAsync(cur);
        }

        private async Task SafePushAsync(NotificationResult n)
        {
            try
            {
                await _hub.Clients.All.SendAsync("ReceiveNotification", n);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SignalR 알림 푸시 실패");
            }
        }
    }
}

