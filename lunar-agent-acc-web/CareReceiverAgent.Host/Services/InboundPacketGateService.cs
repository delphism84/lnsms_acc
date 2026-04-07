using System.Linq;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 시리얼·TCP·UDP 등 모든 수신 라인을 동일 규칙으로 정규화·벨/알림 처리합니다.
    /// </summary>
    public class InboundPacketGateService
    {
        private readonly SerialPortManagerService _manager;
        private readonly NotificationService _notification;
        private readonly NotificationQueueService _queue;
        private readonly ILogger<InboundPacketGateService> _logger;

        public InboundPacketGateService(
            SerialPortManagerService manager,
            NotificationService notification,
            NotificationQueueService queue,
            ILogger<InboundPacketGateService> logger)
        {
            _manager = manager;
            _notification = notification;
            _queue = queue;
            _logger = logger;
        }

        /// <param name="portName">COM 포트명 또는 tcp:/udp: 등 논리 소스(로그용).</param>
        public async Task ProcessInboundAsync(string? portName, string data)
        {
            try
            {
                var svc = _manager.GetServiceOrFirstConnected(portName);
                if (svc == null)
                {
                    _logger.LogWarning(
                        "[벨분석] 수신 포트에 해당하는 SerialPortService 없음 → 정규화·log_*.txt [벨분석] 미기록. Port={Port} RX={Rx}",
                        portName ?? "(null)", TruncateForBellLog(data, 180));
                }

                var normalized = svc != null ? svc.NormalizeInboundLine(data) : data;

                string body = normalized;
                var dot = normalized.IndexOf('.');
                if (dot > 0 && dot < normalized.Length - 1)
                    body = normalized.Substring(dot + 1);
                else if (dot >= 0 && dot == normalized.Length - 1)
                    body = string.Empty;
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

                if (body.Length == 32 && body.All(IsHexLowerOrUpper))
                {
                    var seedTxt = svc?.SessionSeed != null ? $"0x{svc.SessionSeed.Value:x4}" : "없음";
                    svc?.WriteBellAnalysisLog(
                        $"암호문 그대로 상위처리 도달(벨등록 불가) Port={portName} SessionSeed={seedTxt} secure={svc?.SecureEnabled} " +
                        $"legacyBellDecrypt={svc?.LegacyBellDecryptEnabled} " +
                        $"정규화==원문:{string.Equals(normalized, data, StringComparison.Ordinal)} RX={TruncateForBellLog(data, 120)}");
                    if (svc?.SessionSeed != null)
                        _logger.LogWarning(
                            "시리얼 암호화 프레임 복호화 실패 — 벨/데이터 무시. 시드 불일치·CRC 오류 또는 통신체크(.ok)·시드 동기화(.seed) 전 수신 가능. RX={Line}",
                            data);
                    else
                        _logger.LogWarning("시리얼 암호화 프레임 수신(시드 없음). 보안 연결·핸드셰이크 확인. RX={Line}", normalized);
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
                        var rawBell = body.Substring(startIndex);
                        var cut = rawBell.IndexOf('\0');
                        if (cut >= 0) rawBell = rawBell.Substring(0, cut);
                        string bellCode = rawBell.Trim().ToLowerInvariant();
                        bool isBellAddModalOpen = Controllers.WindowController.IsBellAddModalOpen();
                        bool isSettingsView = Controllers.WindowController.IsSettingsView();
                        var seedTxt = svc?.SessionSeed != null ? $"0x{svc.SessionSeed.Value:x4}" : "없음";
                        svc?.WriteBellAnalysisLog(
                            $"bell= 수신 Port={portName} bellCode={bellCode} 벨등록모달열림={isBellAddModalOpen} 설정탭={isSettingsView} " +
                            $"SessionSeed={seedTxt} secure={svc?.SecureEnabled} body={TruncateForBellLog(body, 100)} " +
                            $"원본≠정규화:{!string.Equals(data, normalized, StringComparison.Ordinal)}");

                        _logger.LogInformation("벨 코드 수신: {BellCode}, 원본: {OriginalData}", bellCode, data);
                        Controllers.BellController.SetDetectedBell(bellCode);
                        _notification.ReloadDatabase();
                        var result = _notification.ProcessBellCode(bellCode);
                        svc?.WriteBellAnalysisLog(
                            $"벨 DB조회 bellCode={bellCode} IsRegistered={result?.IsRegistered} " +
                            $"GetPhrase매칭={(result?.IsRegistered == true ? "있음" : "없음")} → /api/bell/detect 폴링에 코드 전달됨");

                        if (result != null && result.IsRegistered)
                        {
                            var phrase = _notification.GetPhraseByBellCode(bellCode);
                            bool isRegisteredBell = phrase != null && phrase.IsEnabled;
                            _logger.LogInformation("벨 코드 처리: {BellCode}, 등록됨: {IsRegistered}, 문구ID: {PhraseId}",
                                bellCode, isRegisteredBell, phrase?.Id ?? 0);
                            bool canShowNow = isRegisteredBell && !isBellAddModalOpen && !isSettingsView;
                            svc?.WriteBellAnalysisLog(
                                $"등록된 벨 알림큐: 표시가능={canShowNow} (모달·설정탭이면 팝업만 억제, 등록모달 폴링은 별개)");
                            await _queue.EnqueueAsync(result, canShowNow);
                            _logger.LogInformation("벨 코드 큐잉 완료: {BellCode}, 표시가능: {CanShowNow}, 메시지: {Message}",
                                bellCode, canShowNow, result.Message);
                        }
                        else if (result != null && !result.IsRegistered)
                        {
                            _logger.LogInformation("등록되지 않은 벨 코드 수신: {BellCode} (알림 전송 안 함)", bellCode);
                            svc?.WriteBellAnalysisLog(
                                $"미등록 벨: 알림 팝업만 생략. 벨등록 모달이 열려 있으면 /api/bell/detect 로 위 bellCode 가져갈 수 있음.");
                        }
                    }
                    else
                    {
                        svc?.WriteBellAnalysisLog($"bell= 형식 오류 '=' 뒤 비어있음 RX={TruncateForBellLog(data, 120)}");
                        _logger.LogWarning("잘못된 벨 코드 형식: {Data}", data);
                    }
                    return;
                }

                if (body.StartsWith("nerf=", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("시리얼 nerf(RF 전달): {Line}", normalized);
                    return;
                }

                if (body.StartsWith("data=", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("시리얼 data(호출/취소/설정): {Line}", normalized);
                    return;
                }

                if (body.StartsWith("ver=", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("시리얼 ver: {Line}", normalized);
                    return;
                }

                if (!string.IsNullOrEmpty(body))
                {
                    if (body.Contains("bell", StringComparison.OrdinalIgnoreCase) &&
                        !body.StartsWith("bell=", StringComparison.OrdinalIgnoreCase))
                    {
                        svc?.WriteBellAnalysisLog(
                            $"벨 관련 키워드 있으나 bell= 로 시작 안 함 → 벨등록 경로 미진입 body={TruncateForBellLog(body, 120)}");
                    }
                    _logger.LogInformation("시리얼 수신(미처리 명령): {Line}", normalized);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "인바운드 패킷 처리 오류");
            }
        }

        private static string TruncateForBellLog(string? s, int maxChars)
        {
            if (string.IsNullOrEmpty(s)) return "(empty)";
            s = s.Replace("\r", "\\r").Replace("\n", "\\n");
            return s.Length <= maxChars ? s : s.Substring(0, maxChars) + "…";
        }

        private static bool IsHexLowerOrUpper(char c) =>
            (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    }
}
