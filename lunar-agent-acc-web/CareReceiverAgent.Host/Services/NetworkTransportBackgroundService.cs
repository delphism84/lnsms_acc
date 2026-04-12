using System.Linq;
using System.Net.Sockets;
using System.Text;
using CareReceiverAgent.Host.Models;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 설정된 TCP/UDP 링크로 수신한 바이트를 라인(\r) 단위로 조립해 <see cref="InboundPacketGateService"/>로 넘깁니다.
    /// </summary>
    public sealed class NetworkTransportBackgroundService : BackgroundService
    {
        private readonly InboundPacketGateService _gate;
        private readonly ILogger<NetworkTransportBackgroundService> _logger;
        private readonly object _reloadLock = new();
        private CancellationTokenSource _reloadCts = new();

        public NetworkTransportBackgroundService(
            InboundPacketGateService gate,
            ILogger<NetworkTransportBackgroundService> logger)
        {
            _gate = gate;
            _logger = logger;
        }

        /// <summary>설정 저장 후 호출하면 연결을 끊고 새 설정으로 다시 붙습니다.</summary>
        public void RequestReloadSettings()
        {
            lock (_reloadLock)
            {
                try { _reloadCts.Cancel(); } catch { /* ignore */ }
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                CancellationTokenSource reloadCts;
                lock (_reloadLock)
                {
                    reloadCts = new CancellationTokenSource();
                    _reloadCts = reloadCts;
                }

                using var linked = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, reloadCts.Token);
                var token = linked.Token;

                try
                {
                    var settings = JsonDatabaseService.LoadNetworkTransportSettings();
                    var links = (settings.Links ?? new List<NetworkTransportEntry>())
                        .Where(l => l.Enabled && l.AutoConnect)
                        .ToList();

                    _logger.LogInformation(
                        "NetworkTransport 설정: 활성 링크 {Count}개 (파일 기준 전체 {Total}개)",
                        links.Count,
                        settings.Links?.Count ?? 0);

                    var tasks = new List<Task>();
                    foreach (var link in links)
                    {
                        var proto = (link.Protocol ?? "tcp").Trim().ToLowerInvariant();
                        if (proto == "udp")
                            tasks.Add(RunUdpAsync(link, token));
                        else
                            tasks.Add(RunTcpAsync(link, token));
                    }

                    if (tasks.Count > 0)
                        await Task.WhenAll(tasks);
                    else
                        await Task.Delay(Timeout.Infinite, token);
                }
                catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogInformation("네트워크 전송 설정 다시 로드");
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "네트워크 전송 루프 오류");
                    try
                    {
                        await Task.Delay(3000, stoppingToken);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }
            }
        }

        private async Task RunTcpAsync(NetworkTransportEntry link, CancellationToken token)
        {
            var label = $"tcp:{link.Id}";
            var linkName = link.Name ?? "";
            var host = (link.Host ?? "").Trim();
            if (string.IsNullOrEmpty(host) || link.Port <= 0 || link.Port > 65535)
            {
                _logger.LogWarning("TCP 링크 설정 무효: {Name} {Host}:{Port}", link.Name, host, link.Port);
                NetworkTransportTcpDebugLog.LogInvalidConfig(label, linkName, host, link.Port);
                try
                {
                    await Task.Delay(Timeout.Infinite, token);
                }
                catch (OperationCanceledException)
                {
                    /* reload or stop */
                }

                return;
            }

            var buffer = new List<byte>();
            var readBuf = new byte[4096];
            var attempt = 0;

            while (!token.IsCancellationRequested)
            {
                attempt++;
                NetworkTransportTcpDebugLog.LogConnectAttempt(label, linkName, host, link.Port, attempt);
                try
                {
                    using var client = new TcpClient();
                    await client.ConnectAsync(host, link.Port, token);
                    attempt = 0;
                    _logger.LogInformation("TCP 연결됨: {Label} {Host}:{Port}", label, host, link.Port);
                    NetworkTransportTcpDebugLog.LogConnected(label, linkName, client);
                    await using var stream = client.GetStream();

                    while (!token.IsCancellationRequested)
                    {
                        var n = await stream.ReadAsync(readBuf.AsMemory(0, readBuf.Length), token);
                        if (n == 0)
                        {
                            NetworkTransportTcpDebugLog.LogRemoteClosed(label, linkName);
                            break;
                        }

                        NetworkTransportTcpDebugLog.LogRxChunk(label, linkName, readBuf.AsSpan(0, n));

                        CrDelimitedRxBuffer.Append(buffer, readBuf.AsSpan(0, n));

                        while (CrDelimitedRxBuffer.TryExtractOneLine(buffer, out var lineBytes))
                        {
                            NetworkTransportTcpDebugLog.LogRxLineAssembled(label, linkName, lineBytes);

                            var line = Encoding.ASCII.GetString(lineBytes).Trim();
                            if (!string.IsNullOrEmpty(line))
                                await _gate.ProcessInboundAsync(label, line);
                        }

                        CrDelimitedRxBuffer.TrimOverflowWithoutCr(buffer, (dropped, kept) =>
                        {
                            _logger.LogWarning(
                                "TCP RX 버퍼 \\r 없이 {Max} 초과 — 선행 {Dropped}바이트 삭제, 꼬리 {Kept}바이트 유지 {Label}",
                                CrDelimitedRxBuffer.MaxPendingWithoutCr, dropped, kept, label);
                        });
                    }
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "TCP {Label} 오류 — 재연결 대기", label);
                    NetworkTransportTcpDebugLog.LogException(label, linkName, ex, "connect-or-read");
                }

                if (token.IsCancellationRequested)
                    return;

                NetworkTransportTcpDebugLog.LogReconnectWait(label, linkName, 5);
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }

        private async Task RunUdpAsync(NetworkTransportEntry link, CancellationToken token)
        {
            var label = $"udp:{link.Id}";
            var host = (link.Host ?? "").Trim();
            if (string.IsNullOrEmpty(host) || link.Port <= 0 || link.Port > 65535)
            {
                _logger.LogWarning("UDP 링크 설정 무효: {Name} {Host}:{Port}", link.Name, host, link.Port);
                try
                {
                    await Task.Delay(Timeout.Infinite, token);
                }
                catch (OperationCanceledException)
                {
                    /* reload or stop */
                }

                return;
            }

            while (!token.IsCancellationRequested)
            {
                try
                {
                    using var udp = new UdpClient();
                    udp.Connect(host, link.Port);
                    _logger.LogInformation("UDP 연결됨: {Label} {Host}:{Port}", label, host, link.Port);
                    // 상대(서버)가 에이전트의 에페메럴 포트를 알 수 있도록 1회 전송(펀치홀)
                    try
                    {
                        var hello = Encoding.ASCII.GetBytes("hello\r");
                        await udp.SendAsync(hello, token);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "UDP hello 전송 실패(수신만으로 동작하는 환경이면 무시 가능): {Label}", label);
                    }

                    while (!token.IsCancellationRequested)
                    {
                        var result = await udp.ReceiveAsync(token);
                        var line = Encoding.ASCII.GetString(result.Buffer).Trim().TrimEnd('\r', '\n');
                        if (!string.IsNullOrEmpty(line))
                            await _gate.ProcessInboundAsync(label, line);
                    }
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "UDP {Label} 오류 — 재연결 대기", label);
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }
}
