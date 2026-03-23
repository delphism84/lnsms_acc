using System.Linq;
using CareReceiverAgent.Host.Hubs;
using CareReceiverAgent.Host.Models;
using Microsoft.AspNetCore.SignalR;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 백그라운드 서비스 - 시리얼 포트 모니터링 및 알림 처리 (다중 포트)
    /// </summary>
    public class SerialPortBackgroundService : BackgroundService
    {
        private readonly SerialPortManagerService _manager;
        private readonly NotificationService _notification;
        private readonly NotificationQueueService _queue;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<SerialPortBackgroundService> _logger;

        public SerialPortBackgroundService(
            SerialPortManagerService manager,
            NotificationService notification,
            NotificationQueueService queue,
            IHubContext<NotificationHub> hubContext,
            ILogger<SerialPortBackgroundService> logger)
        {
            _manager = manager;
            _notification = notification;
            _queue = queue;
            _hubContext = hubContext;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _manager.DataReceived += async (s, e) =>
            {
                await ProcessSerialData(e.PortName, e.Data);
            };

            // 등록된 포트 중 AutoConnect인 항목 자동 연결 (실패 시 재시도)
            while (!stoppingToken.IsCancellationRequested)
            {
                var settings = JsonDatabaseService.LoadSerialSettings();
                var autoEntries = (settings.Ports ?? new List<SerialPortEntry>()).Where(p => p.AutoConnect).ToList();
                if (autoEntries.Count == 0)
                    break;

                var connected = _manager.ConnectedPortNames;
                var missing = autoEntries.Where(p => !connected.Contains(p.PortName, StringComparer.OrdinalIgnoreCase)).ToList();
                if (missing.Count == 0)
                    break;

                foreach (var entry in missing)
                {
                    var ok = _manager.Connect(entry);
                    if (ok)
                        _logger.LogInformation("시리얼 포트 연결 성공: {Port}", entry.PortName);
                    else
                        _logger.LogWarning("시리얼 포트 연결 실패: {Port} (5초 후 재시도)", entry.PortName);
                }
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }

        private async Task ProcessSerialData(string? portName, string data)
        {
            try
            {
                var svc = _manager.GetService(portName);
                var normalized = svc != null ? svc.NormalizeInboundLine(data) : data;

                string body = normalized;
                var dot = normalized.IndexOf('.');
                if (dot > 0 && dot < normalized.Length - 1)
                    body = normalized.Substring(dot + 1);
                body = body.Trim();

                if (body.StartsWith("seed=", StringComparison.Ordinal))
                {
                    var mark = body.Substring("seed=".Length);
                    svc?.UpdateSessionSeedFromMark(mark);
                    _logger.LogInformation("세션 시드 동기화 수신(보안 모드 활성화)");
                    return;
                }

                if (string.Equals(body, "ok", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("통신 체크 응답 수신: ok");
                    return;
                }

                if (string.Equals(body, "ready", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("Care Receiver 준비완료");
                    return;
                }

                if (body.StartsWith("assist", StringComparison.OrdinalIgnoreCase))
                {
                    string assistBellCode = "crcv.assist";
                    _logger.LogInformation("도움 요청 수신: {BellCode}", assistBellCode);
                    Controllers.BellController.SetDetectedBell(assistBellCode);
                    _notification.ReloadDatabase();
                    var result = _notification.ProcessBellCode(assistBellCode);
                    if (result != null && result.IsRegistered)
                    {
                        var phrase = _notification.GetPhraseByBellCode(assistBellCode);
                        bool isRegisteredBell = phrase != null && phrase.IsEnabled;
                        _logger.LogInformation("도움 요청 처리: {BellCode}, 등록됨: {IsRegistered}, 문구ID: {PhraseId}",
                            assistBellCode, isRegisteredBell, phrase?.Id ?? 0);
                        bool isBellAddModalOpen = Controllers.WindowController.IsBellAddModalOpen();
                        bool isSettingsView = Controllers.WindowController.IsSettingsView();
                        bool canShowNow = isRegisteredBell && !isBellAddModalOpen && !isSettingsView;
                        await _queue.EnqueueAsync(result, canShowNow);
                    }
                    else if (result != null && !result.IsRegistered)
                        _logger.LogInformation("등록되지 않은 도움 요청 수신: {BellCode} (알림 전송 안 함)", assistBellCode);
                    return;
                }

                if (body.StartsWith("bell=", StringComparison.OrdinalIgnoreCase))
                {
                    int startIndex = body.IndexOf('=') + 1;
                    if (startIndex > 0 && startIndex < body.Length)
                    {
                        string bellCode = body.Substring(startIndex).Trim().ToLowerInvariant();
                        _logger.LogInformation("벨 코드 수신: {BellCode}, 원본: {OriginalData}", bellCode, data);
                        Controllers.BellController.SetDetectedBell(bellCode);
                        _notification.ReloadDatabase();
                        var result = _notification.ProcessBellCode(bellCode);
                        if (result != null && result.IsRegistered)
                        {
                            var phrase = _notification.GetPhraseByBellCode(bellCode);
                            bool isRegisteredBell = phrase != null && phrase.IsEnabled;
                            _logger.LogInformation("벨 코드 처리: {BellCode}, 등록됨: {IsRegistered}, 문구ID: {PhraseId}",
                                bellCode, isRegisteredBell, phrase?.Id ?? 0);
                            bool isBellAddModalOpen = Controllers.WindowController.IsBellAddModalOpen();
                            bool isSettingsView = Controllers.WindowController.IsSettingsView();
                            bool canShowNow = isRegisteredBell && !isBellAddModalOpen && !isSettingsView;
                            await _queue.EnqueueAsync(result, canShowNow);
                            _logger.LogInformation("벨 코드 큐잉 완료: {BellCode}, 표시가능: {CanShowNow}, 메시지: {Message}",
                                bellCode, canShowNow, result.Message);
                        }
                        else if (result != null && !result.IsRegistered)
                            _logger.LogInformation("등록되지 않은 벨 코드 수신: {BellCode} (알림 전송 안 함)", bellCode);
                    }
                    else
                        _logger.LogWarning("잘못된 벨 코드 형식: {Data}", data);
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "시리얼 데이터 처리 오류");
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _manager.DisconnectAll();
            await base.StopAsync(cancellationToken);
        }
    }
}
