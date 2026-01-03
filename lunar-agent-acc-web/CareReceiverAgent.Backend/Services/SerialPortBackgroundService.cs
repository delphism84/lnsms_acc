using CareReceiverAgent.Backend.Hubs;
using CareReceiverAgent.Backend.Models;
using Microsoft.AspNetCore.SignalR;

namespace CareReceiverAgent.Backend.Services
{
    /// <summary>
    /// 백그라운드 서비스 - 시리얼 포트 모니터링 및 알림 처리
    /// </summary>
    public class SerialPortBackgroundService : BackgroundService
    {
        private readonly SerialPortService _serialPort;
        private readonly NotificationService _notification;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<SerialPortBackgroundService> _logger;

        public SerialPortBackgroundService(
            SerialPortService serialPort,
            NotificationService notification,
            IHubContext<NotificationHub> hubContext,
            ILogger<SerialPortBackgroundService> logger)
        {
            _serialPort = serialPort;
            _notification = notification;
            _hubContext = hubContext;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // 시리얼 포트 이벤트 연결
            _serialPort.DataReceived += async (s, data) =>
            {
                await ProcessSerialData(data);
            };

            // 시리얼 포트 연결
            var settings = JsonDatabaseService.LoadSerialSettings();
            if (settings.AutoConnect)
            {
                var connected = _serialPort.Connect(settings.PortName, settings.BaudRate);
                if (connected)
                {
                    _logger.LogInformation("시리얼 포트 연결 성공: {Port}", settings.PortName);
                }
                else
                {
                    _logger.LogWarning("시리얼 포트 연결 실패: {Port}", settings.PortName);
                }
            }

            // 서비스 종료 대기
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }

        private async Task ProcessSerialData(string data)
        {
            try
            {
                // 준비 완료 메시지
                if (data == "crcv.readywrwn" || data == "okwrwn")
                {
                    _logger.LogInformation("Care Receiver 준비 완료");
                    return;
                }

                // 벨 수신코드 처리
                if (data.StartsWith("crcv.bell="))
                {
                    string bellData = data.Replace("crcv.bell=", "").Trim();
                    if (bellData.Length >= 5)
                    {
                        string bellCode = bellData.Substring(0, 5);
                        var result = _notification.ProcessBellCode(bellCode);

                        if (result != null)
                        {
                            // SignalR로 실시간 푸시
                            await _hubContext.Clients.All.SendAsync("ReceiveNotification", result);
                            _logger.LogInformation("벨 코드 알림 전송: {BellCode}", bellCode);
                        }
                    }
                    return;
                }

                // 장애인 리모컨 수신 처리
                if (data == "crcv.assistWrWn")
                {
                    var result = _notification.ProcessAssistRequest();
                    await _hubContext.Clients.All.SendAsync("ReceiveNotification", result);
                    _logger.LogInformation("도움 요청 알림 전송");
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
            _serialPort.Disconnect();
            await base.StopAsync(cancellationToken);
        }
    }
}

