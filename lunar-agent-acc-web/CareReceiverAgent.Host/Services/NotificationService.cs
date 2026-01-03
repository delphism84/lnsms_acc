using System;
using System.Linq;
using CareReceiverAgent.Host.Models;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// ?�림 ?�비??- �??�신 ???�림 처리
    /// </summary>
    public class NotificationService
    {
        private readonly object _lock = new object();

        public NotificationService()
        {
            // 캐싱 제거: 항상 JSON에서 읽어옴
        }

        private PhraseDatabase GetDatabase()
        {
            // 항상 JSON에서 최신 데이터를 읽어옴 (캐싱 없음)
            return JsonDatabaseService.LoadPhrases();
        }

        public PhraseModel? GetPhraseByBellCode(string bellCode)
        {
            lock (_lock)
            {
                // 항상 JSON에서 최신 데이터를 읽어옴
                var database = GetDatabase();
                
                // 벨 코드를 소문자로 정규화하여 비교
                string normalizedBellCode = bellCode?.ToLowerInvariant() ?? string.Empty;
                
                // 벨 코드로 문구 찾기 (대소문자 무시)
                return database.Phrases
                    .FirstOrDefault(p => p.IsEnabled && 
                        p.BellCodes != null && 
                        p.BellCodes.Any(code => string.Equals(code?.ToLowerInvariant(), normalizedBellCode, StringComparison.OrdinalIgnoreCase)));
            }
        }

        public NotificationResult? ProcessBellCode(string bellCode)
        {
            // 벨 코드로 문구 찾기 (항상 최신 데이터에서)
            var phrase = GetPhraseByBellCode(bellCode);

            if (phrase != null)
            {
                return new NotificationResult
                {
                    Message = phrase.Text,
                    Color = phrase.Color,
                    Type = "bell",
                    IsRegistered = true,
                    Uid = phrase.Uid
                };
            }
            else
            {
                // 등록되지 않은 벨
                return new NotificationResult
                {
                    Message = $"벨 코드: {bellCode}",
                    Color = "#000000",
                    Type = "bell",
                    IsRegistered = false
                };
            }
        }

        public NotificationResult ProcessAssistRequest()
        {
            // ?�애??리모�??�신 - 고정 ?�시
            return new NotificationResult
            {
                Message = "출입구에???��????�청?�니??",
                Color = "#FF0000",
                Type = "assist"
            };
        }

        public void ReloadDatabase()
        {
            // 캐싱이 없으므로 아무 작업도 하지 않음
            // 다음 GetPhraseByBellCode 호출 시 자동으로 최신 데이터를 읽어옴
        }
    }

    public class NotificationResult
    {
        public string Message { get; set; } = string.Empty;
        public string Color { get; set; } = "#000000";
        public string Type { get; set; } = "bell";
        public bool IsRegistered { get; set; } = false;
        public string? Uid { get; set; }
    }
}

