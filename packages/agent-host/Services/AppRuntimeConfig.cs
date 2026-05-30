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

        /// <summary>로컬 StoreKey — 업체 ID (고정 necall).</summary>
        public string Userid { get; set; } = "necall";
        /// <summary>로컬 StoreKey — 매장 ID (고정 guest).</summary>
        public string StoreId { get; set; } = "guest";
        /// <summary>로컬 auto-login 비밀번호 (F1 seed와 동일).</summary>
        public string LocalGuestPassword { get; set; } = "guest";

        [Obsolete("Use Userid")]
        public string QaUserId { get => Userid; set => Userid = value; }
        [Obsolete("Use StoreId")]
        public string QaStoreId { get => StoreId; set => StoreId = value; }

        /// <summary>로컬 LNSMS(Node) API — lnsms-be (기본 http://127.0.0.1:40000).</summary>
        public string LnsmsApiBaseLocal { get; set; } = "http://127.0.0.1:40000";
        /// <summary>레거시 alias — LnsmsApiBaseLocal.</summary>
        public string LnsmsApiBase
        {
            get => LnsmsApiBaseLocal;
            set => LnsmsApiBaseLocal = value;
        }

        /// <summary>매장 Admin FE (Next dev) 베이스 URL.</summary>
        public string LnsmsUiBaseLocal { get; set; } = "http://127.0.0.1:63001";
        /// <summary>레거시 alias — LnsmsUiBaseLocal.</summary>
        public string LnsmsUiBase
        {
            get => LnsmsUiBaseLocal;
            set => LnsmsUiBaseLocal = value;
        }

        public string LnsmsApiBaseRemote { get; set; } = "https://admin.necall.com";
        public string LnsmsWsUrlRemote { get; set; } = "wss://admin.necall.com/ws";

        /// <summary>로컬 스택(mongod + lnsms-be + admin-fe) 자동 기동.</summary>
        public bool LocalStackEnabled { get; set; } = true;

        /// <summary>external = mongod data dir / memory = BE 인메모리 Mongo (Supervisor 미사용 시 BE env).</summary>
        public string MongoMode { get; set; } = "external";

        /// <summary>mongoMode=external 이고 mongod 없을 때 memory로 기동 (데이터는 재시작 시 초기화).</summary>
        public bool MongoFallbackToMemory { get; set; } = true;

        public string? MongoDataDir { get; set; }

        public int MongoPort { get; set; } = 27017;

        public string? MongoExe { get; set; }

        public int LnsmsBePort { get; set; } = 40000;

        public int LnsmsFePort { get; set; } = 63001;

        /// <summary>에이전트 Kestrel 포트(killExistingOnStart 시 함께 정리).</summary>
        public int AgentApiPort { get; set; } = 58000;

        /// <summary>packages/lnsms-be·lnsms-admin-fe 가 있는 monorepo 루트.</summary>
        public string? RepoRoot { get; set; }

        /// <summary>기동 전 27017/40000/63001 리스너 PID만 종료 (node.exe 전체 kill 금지).</summary>
        public bool KillExistingOnStart { get; set; } = true;

        /// <summary>운영 sync·업로드 LNSMS URL.</summary>
        public string LnsmsRemoteUploadBase
        {
            get => LnsmsApiBaseRemote;
            set => LnsmsApiBaseRemote = value;
        }

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

        public string BuildStoreSettingUrl()
        {
            var baseUi = (string.IsNullOrWhiteSpace(LnsmsUiBaseLocal) ? "http://127.0.0.1:63001" : LnsmsUiBaseLocal).TrimEnd('/');
            var uid = string.IsNullOrWhiteSpace(Userid) ? "necall" : Userid.Trim();
            var sid = string.IsNullOrWhiteSpace(StoreId) ? "guest" : StoreId.Trim();
            return $"{baseUi}/s/{uid}/{sid}/setting";
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

