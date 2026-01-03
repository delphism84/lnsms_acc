using System;
using System.Linq;
using CareReceiverAgent.Backend.Models;

namespace CareReceiverAgent.Backend.Services
{
    /// <summary>
    /// 알림 서비스 - 벨 수신 시 알림 처리
    /// </summary>
    public class NotificationService
    {
        private PhraseDatabase _database;

        public NotificationService()
        {
            _database = JsonDatabaseService.LoadPhrases();
        }

        public NotificationResult? ProcessBellCode(string bellCode)
        {
            // 벨 코드로 문구 찾기
            var phrase = _database.Phrases
                .FirstOrDefault(p => p.IsEnabled && p.BellCodes.Contains(bellCode));

            if (phrase != null)
            {
                return new NotificationResult
                {
                    Message = phrase.Text,
                    Color = phrase.Color,
                    Type = "bell"
                };
            }
            else
            {
                // 등록되지 않은 벨
                return new NotificationResult
                {
                    Message = $"벨 코드: {bellCode}",
                    Color = "#000000",
                    Type = "bell"
                };
            }
        }

        public NotificationResult ProcessAssistRequest()
        {
            // 장애인 리모컨 수신 - 고정 표시
            return new NotificationResult
            {
                Message = "출입구에서 도움을 요청합니다.",
                Color = "#FF0000",
                Type = "assist"
            };
        }

        public void ReloadDatabase()
        {
            _database = JsonDatabaseService.LoadPhrases();
        }
    }

    public class NotificationResult
    {
        public string Message { get; set; } = string.Empty;
        public string Color { get; set; } = "#000000";
        public string Type { get; set; } = "bell";
    }
}

