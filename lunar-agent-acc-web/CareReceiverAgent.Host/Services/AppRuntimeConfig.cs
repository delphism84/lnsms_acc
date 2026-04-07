using System.Text.Json;

namespace CareReceiverAgent.Host.Services
{
    public class AppRuntimeConfig
    {
        public string Title { get; set; } = "장애인도움요청";
        public string NotificationTitle { get; set; } = "장애인도움요청";
        /// <summary>알림창 좌측 하단 고객센터 문구(빈 값이면 미표시).</summary>
        public string SystemNotifyCallTelText { get; set; } = "";
        /// <summary>설정 진입/로그 조회용 시스템 비밀번호.</summary>
        public string SystemAccessPassword { get; set; } = "8206";
        /// <summary>실행 폴더 resource 내 트레이·창 아이콘 파일명 (.ico). 없으면 appicon.ico 등으로 대체.</summary>
        public string TrayIconFileName { get; set; } = "appicon.ico";
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
        /// <summary>로컬 LNSMS(Node) API. 에이전트·WebView: 로그인·다운로드·브로드캐스트 등 (기본 localhost:60000, app.json로 변경).</summary>
        public string LnsmsApiBase { get; set; } = "http://localhost:60000";

        /// <summary>운영 업로드 전용 LNSMS URL. 설정 업로드(세트 PUT/POST)만 이 주소로 호출 (기본 https://admin.necall.com).</summary>
        public string LnsmsRemoteUploadBase { get; set; } = "https://admin.necall.com";

        /// <summary>
        /// 시리얼 v4 암호화(보안) 마스터 스위치. false(기본)면 모든 COM 연결에서 암호화 비활성(포트별 저장값 무시).
        /// true이면 각 포트의 시리얼 보안(암호화) 설정을 적용합니다.
        /// </summary>
        public bool SerialEncryptionEnabled { get; set; } = false;

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

        public static void Save(AppRuntimeConfig cfg)
        {
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.json");
            var json = JsonSerializer.Serialize(cfg, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            File.WriteAllText(path, json, System.Text.Encoding.UTF8);
        }
    }
}

