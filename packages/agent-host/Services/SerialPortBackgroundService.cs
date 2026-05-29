using System;
using System.Linq;
using CareReceiverAgent.Host.Models;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 백그라운드 서비스 - 시리얼 포트 모니터링 및 알림 처리 (다중 포트)
    /// </summary>
    public class SerialPortBackgroundService : BackgroundService
    {
        private readonly SerialPortManagerService _manager;
        private readonly InboundPacketGateService _gate;
        private readonly ILogger<SerialPortBackgroundService> _logger;

        public SerialPortBackgroundService(
            SerialPortManagerService manager,
            InboundPacketGateService gate,
            ILogger<SerialPortBackgroundService> logger)
        {
            _manager = manager;
            _gate = gate;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _manager.DataReceived += async (s, e) =>
            {
                await _gate.ProcessInboundAsync(e.PortName, e.Data);
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

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _manager.DisconnectAll();
            await base.StopAsync(cancellationToken);
        }
    }
}
