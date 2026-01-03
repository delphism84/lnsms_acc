using CareReceiverAgent.Host.Hubs;
using CareReceiverAgent.Host.Models;
using Microsoft.AspNetCore.SignalR;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 백그?�운???�비??- ?�리???�트 모니?�링 �??�림 처리
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
            // ?�리???�트 ?�벤???�결
            _serialPort.DataReceived += async (s, data) =>
            {
                await ProcessSerialData(data);
            };

            // 시리얼 포트 자동 연결(실패 시 재시도)
            while (!stoppingToken.IsCancellationRequested)
            {
                var settings = JsonDatabaseService.LoadSerialSettings();

                if (!settings.AutoConnect)
                {
                    break;
                }

                if (_serialPort.IsConnected)
                {
                    break;
                }

                var connected = _serialPort.Connect(settings.PortName, settings.BaudRate);
                if (connected)
                {
                    _logger.LogInformation("시리얼 포트 연결 성공: {Port}", settings.PortName);
                    break;
                }

                _logger.LogWarning("시리얼 포트 연결 실패: {Port} (5초 후 재시도)", settings.PortName);
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }

            // ?�비??종료 ?��?
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }

        private async Task ProcessSerialData(string data)
        {
            try
            {
                // 통신 체크 응답 (Care Receiver -> PC)
                if (data == "ok")
                {
                    _logger.LogInformation("통신 체크 응답 수신: ok");
                    return;
                }

                // 준비완료 메시지 (Care Receiver -> PC)
                if (data == "crcv.ready")
                {
                    _logger.LogInformation("Care Receiver 준비완료");
                    return;
                }

                // 도움 요청 메시지 (Care Receiver -> PC)
                // 형식: crcv.assist\r\n
                if (data.StartsWith("crcv.assist"))
                {
                    string assistBellCode = "crcv.assist";
                    _logger.LogInformation("도움 요청 수신: {BellCode}", assistBellCode);
                    
                    // 벨 감지 API에 알림
                    Controllers.BellController.SetDetectedBell(assistBellCode);
                    
                    // 데이터베이스 재로드 (최신 데이터 확인)
                    _notification.ReloadDatabase();
                    
                    var result = _notification.ProcessBellCode(assistBellCode);
                    
                    if (result != null && result.IsRegistered)
                    {
                        // 등록된 벨인지 확인
                        var phrase = _notification.GetPhraseByBellCode(assistBellCode);
                        bool isRegisteredBell = phrase != null && phrase.IsEnabled;
                        
                        _logger.LogInformation("도움 요청 처리: {BellCode}, 등록됨: {IsRegistered}, 문구ID: {PhraseId}", 
                            assistBellCode, isRegisteredBell, phrase?.Id ?? 0);
                        
                        if (isRegisteredBell)
                        {
                            // 벨 등록 모달이 열려있으면 알림창으로 이동하지 않음
                            bool isBellAddModalOpen = Controllers.WindowController.IsBellAddModalOpen();
                            if (!isBellAddModalOpen)
                            {
                                // 등록된 벨인 경우 창 표시 및 알림창 전환
                                Form1.ShowNotificationWindow();
                            }
                            else
                            {
                                _logger.LogInformation("벨 등록 모달이 열려있어 알림창 표시 안 함: {BellCode}", assistBellCode);
                            }
                        }
                        
                        // uid 맵에 등록 (등록된 벨만)
                        Controllers.NotificationsController.UpsertActiveNotification(result);
                        
                        // SignalR로 실시간 푸시 - 등록된 벨만 전송
                        await _hubContext.Clients.All.SendAsync("ReceiveNotification", result);
                    }
                    else if (result != null && !result.IsRegistered)
                    {
                        // 등록되지 않은 벨은 로그만 기록하고 알림 전송하지 않음
                        _logger.LogInformation("등록되지 않은 도움 요청 수신: {BellCode} (알림 전송 안 함)", assistBellCode);
                    }
                    
                    return;
                }

                // 벨 수신코드 처리 (Care Receiver -> PC)
                // 형식: crcv.bell=0d3213\r\n
                if (data.StartsWith("crcv.bell="))
                {
                    // = 다음부터 \r 또는 \n까지의 문자열 추출
                    int startIndex = data.IndexOf('=') + 1;
                    int endIndex = data.Length;
                    
                    // \r 또는 \n 찾기
                    int crIndex = data.IndexOf('\r', startIndex);
                    int lfIndex = data.IndexOf('\n', startIndex);
                    
                    if (crIndex >= startIndex && crIndex < endIndex)
                        endIndex = crIndex;
                    if (lfIndex >= startIndex && lfIndex < endIndex)
                        endIndex = Math.Min(endIndex, lfIndex);
                    
                    if (startIndex < endIndex)
                    {
                        string bellCode = data.Substring(startIndex, endIndex - startIndex).ToLowerInvariant();
                        
                        _logger.LogInformation("벨 코드 수신: {BellCode}, 원본: {OriginalData}", bellCode, data);
                        
                        // 벨 감지 API에 알림 (소문자로 정규화된 코드 저장)
                        Controllers.BellController.SetDetectedBell(bellCode);
                        
                        // 데이터베이스 재로드 (최신 데이터 확인)
                        _notification.ReloadDatabase();
                        
                        var result = _notification.ProcessBellCode(bellCode);

                        if (result != null && result.IsRegistered)
                        {
                            // 등록된 벨인지 확인 (벨 코드로 문구를 찾았는지)
                            var phrase = _notification.GetPhraseByBellCode(bellCode);
                            bool isRegisteredBell = phrase != null && phrase.IsEnabled;
                            
                            _logger.LogInformation("벨 코드 처리: {BellCode}, 등록됨: {IsRegistered}, 문구ID: {PhraseId}", 
                                bellCode, isRegisteredBell, phrase?.Id ?? 0);
                            
                            if (isRegisteredBell)
                            {
                                // 벨 등록 모달이 열려있으면 알림창으로 이동하지 않음
                                bool isBellAddModalOpen = Controllers.WindowController.IsBellAddModalOpen();
                                if (!isBellAddModalOpen)
                                {
                                    // 등록된 벨인 경우 창 표시 및 알림창 전환
                                    Form1.ShowNotificationWindow();
                                }
                                else
                                {
                                    _logger.LogInformation("벨 등록 모달이 열려있어 알림창 표시 안 함: {BellCode}", bellCode);
                                }
                            }
                            
                            // uid 맵에 등록 (등록된 벨만)
                            Controllers.NotificationsController.UpsertActiveNotification(result);
                            
                            // SignalR로 실시간 푸시 - 등록된 벨만 전송
                            await _hubContext.Clients.All.SendAsync("ReceiveNotification", result);
                            _logger.LogInformation("벨 코드 알림 전송 완료: {BellCode}, 등록됨: {IsRegistered}, 메시지: {Message}", 
                                bellCode, isRegisteredBell, result.Message);
                        }
                        else if (result != null && !result.IsRegistered)
                        {
                            // 등록되지 않은 벨은 로그만 기록하고 알림 전송하지 않음
                            _logger.LogInformation("등록되지 않은 벨 코드 수신: {BellCode} (알림 전송 안 함)", bellCode);
                        }
                    }
                    else
                    {
                        _logger.LogWarning("잘못된 벨 코드 형식: {Data}", data);
                    }
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

