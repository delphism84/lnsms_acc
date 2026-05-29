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

## 동기화 테스트 (로컬 두 DB)

1. 로컬 A에서 `/platform` → Export JSON
2. 로컬 B(다른 mongo)에서 Import replace
3. `/s/{agentId}/{storeId}/setting` 새로고침 → 반영 확인

서버 배포 후에는 A=로컬 export, B=서버 `POST .../sync/import` (스크립트/UI 추가 예정).
