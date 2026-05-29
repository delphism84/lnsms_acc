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
# 스택만
.\scripts\dev-agent.ps1

# Agent 포함 (LocalStack + WebView)
cd packages\agent-host
dotnet run
```

## 환경

- BE: `MONGODB_URI=mongodb://127.0.0.1:27017/lnsms` (external) 또는 `memory`
- FE: `NEXT_PUBLIC_API_URL=http://127.0.0.1:40000`

## 서버 동기화 (매장 setting)

`/s/{agentId}/{storeId}/setting` → **서버 DB 동기화** 패널

1. 운영 서버 URL 입력 (예: `https://your-host` — BE가 프록시되는 주소)
2. **서버로 업로드** / **서버에서 다운로드**

`.env.local` 기본값: `LNSMS_SYNC_SERVER_URL=https://...`
