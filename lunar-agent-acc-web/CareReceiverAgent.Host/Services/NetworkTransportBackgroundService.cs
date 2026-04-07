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
            var host = (link.Host ?? "").Trim();
            if (string.IsNullOrEmpty(host) || link.Port <= 0 || link.Port > 65535)
            {
                _logger.LogWarning("TCP 링크 설정 무효: {Name} {Host}:{Port}", link.Name, host, link.Port);
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

            while (!token.IsCancellationRequested)
            {
                try
                {
                    using var client = new TcpClient();
                    await client.ConnectAsync(host, link.Port, token);
                    _logger.LogInformation("TCP 연결됨: {Label} {Host}:{Port}", label, host, link.Port);
                    await using var stream = client.GetStream();

                    while (!token.IsCancellationRequested)
                    {
                        var n = await stream.ReadAsync(readBuf.AsMemory(0, readBuf.Length), token);
                        if (n == 0) break;

                        for (var i = 0; i < n; i++)
                            buffer.Add(readBuf[i]);

                        while (true)
                        {
                            var cr = buffer.IndexOf((byte)0x0d);
                            if (cr < 0) break;
                            var lineBytes = buffer.Take(cr).ToArray();
                            buffer.RemoveRange(0, cr + 1);
                            while (buffer.Count > 0 && buffer[0] == 0x0a)
                                buffer.RemoveAt(0);

                            var line = Encoding.ASCII.GetString(lineBytes).Trim();
                            if (!string.IsNullOrEmpty(line))
                                await _gate.ProcessInboundAsync(label, line);
                        }

                        if (buffer.Count > 4096)
                            buffer.Clear();
                    }
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "TCP {Label} 오류 — 재연결 대기", label);
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
