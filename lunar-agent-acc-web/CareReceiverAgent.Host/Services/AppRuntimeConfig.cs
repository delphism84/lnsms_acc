using System.Text.Json;

namespace CareReceiverAgent.Host.Services
{
    public class AppRuntimeConfig
    {
        public string Title { get; set; } = "장애인알림시스템";
        public string NotificationTitle { get; set; } = "장애인 도움 요청";
        /// <summary>MongoDB 연결 문자열. 비어 있으면 JSON 파일 사용.</summary>
        public string? MongoConnectionString { get; set; }
        /// <summary>MongoDB 데이터베이스 이름. 비어 있으면 "agent".</summary>
        public string MongoDatabaseName { get; set; } = "agent";

        /// <summary>QA 검수 모드. true면 실행 시 문구가 없을 때 QA용 기본 데이터 시드.</summary>
        public bool QaEnabled { get; set; } = true;
        /// <summary>QA 검수용 유저 ID (표시/연동용).</summary>
        public string QaUserId { get; set; } = "qa-user-001";
        /// <summary>QA 검수용 매장 ID (표시/연동용).</summary>
        public string QaStoreId { get; set; } = "qa-store-001";
        /// <summary>LNSMS(Node) API 베이스 URL. 봇: 로그인·다운로드용.</summary>
        public string LnsmsApiBase { get; set; } = "http://localhost:60000";

        public static AppRuntimeConfig Load()
        {
            try
            {
                var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.json");
                if (!File.Exists(path)) return new AppRuntimeConfig();

                var json = File.ReadAllText(path, System.Text.Encoding.UTF8);
                var cfg = JsonSerializer.Deserialize<AppRuntimeConfig>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                return cfg ?? new AppRuntimeConfig();
            }
            catch
            {
                return new AppRuntimeConfig();
            }
        }
    }
}

