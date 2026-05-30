# 로컬 개발

## 접속 URL

| 용도 | URL |
|------|-----|
| Admin (홈) | http://127.0.0.1:63001 |
| Platform | http://127.0.0.1:63001/platform |
| 로그인 | http://127.0.0.1:63001/login |
| BE Health | http://127.0.0.1:40000/health |
| 매장 콘솔 | http://127.0.0.1:63001/s/{agentId}/{storeId}/setting |
| Agent API | http://localhost:58000 |
| Agent 설정 | http://localhost:58000?view=settings |

기본 `resource/app.json`: `a1` / `s1` → http://127.0.0.1:63001/s/a1/s1/setting

## 빠른 기동

```powershell
# 포트 정리 후 스택/Host
.\scripts\kill-lnsms-ports.ps1

# 스택만
.\scripts\dev-agent.ps1

# Agent 포함 (LocalStack + WebView)
cd packages\agent-host
dotnet run
```

## 환경

- BE: `MONGODB_URI=mongodb://127.0.0.1:27017/lnsms` (external) 또는 `memory`
- FE: `NEXT_PUBLIC_API_URL=http://127.0.0.1:40000`

### MongoDB (영구 저장)

`mongoMode: external` 이면 **mongod** 가 필요합니다.

1. [MongoDB Community](https://www.mongodb.com/try/download/community) 설치 (기본 경로 예: `C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe`)
2. 또는 `resource/app.json`에 절대 경로 지정: `"mongoExe": "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe"`

mongod가 없으면 Host는 기본값 `mongoFallbackToMemory: true` 로 **memory** DB로 기동합니다(재시작 시 데이터 초기화). 영구 저장이 필요하면 MongoDB를 설치하세요.

## 서버 동기화 (매장 setting)

`/s/{agentId}/{storeId}/setting` → **서버 DB 동기화** 패널

1. 운영 서버 URL 입력 (예: `https://your-host` — BE가 프록시되는 주소)
2. **서버로 업로드** / **서버에서 다운로드**

`.env.local` 기본값: `LNSMS_SYNC_SERVER_URL=https://...`
