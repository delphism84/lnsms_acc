# Agent 로컬 스택 (Host + lnsms-be + admin-fe + mongod)

## 포트

| 서비스 | 포트 | 역할 |
|--------|------|------|
| CareReceiverAgent.Host (Kestrel) | 58000 | 시리얼·SignalR·알림·설정 UI (`?view=settings`) |
| mongod | 27017 | 매장 데이터 (`data/mongo`) |
| lnsms-be | 40000 | Platform + Store API |
| lnsms-admin-fe | 63001 | 매장 콘솔 WebView |

## 경로 (스캐폴드)

- Monorepo: `c:\rc\lnsms-acc-scaffold`
- Mongo data: `data\mongo`
- C# Host: `packages\agent-host`
- 설정: `resource\app.json` → 빌드 시 exe 옆 `app.json`

## WebView 초기 URL

```
http://127.0.0.1:63001/s/{qaUserId}/{qaStoreId}/setting
```

트레이 「열기」→ 에이전트 설정: `http://localhost:58000?view=settings`

## app.json (요약)

```json
{
  "qaUserId": "a1",
  "qaStoreId": "s1",
  "lnsmsApiBase": "http://127.0.0.1:40000",
  "lnsmsUiBase": "http://127.0.0.1:63001",
  "localStackEnabled": true,
  "mongoMode": "external",
  "mongoDataDir": "C:\\rc\\lnsms-acc-scaffold\\data\\mongo",
  "repoRoot": "C:\\rc\\lnsms-acc-scaffold",
  "killExistingOnStart": true
}
```

`localStackEnabled: false` → Host만 기동 (스택은 `scripts\dev-agent.ps1`로 수동).

## 스크립트

| 스크립트 | 용도 |
|----------|------|
| `scripts\dev-agent.ps1` | mongod + BE + FE (Host 없이 검증) |
| `scripts\start-mongo.ps1` | mongod만 |
| `scripts\local-store.ps1` | memory Mongo + BE + FE |
| `scripts\local-store.ps1` | memory Mongo + BE + FE (단일 매장) |

`resource/app.json`의 `repoRoot`는 이 리포 루트 절대 경로로 맞춥니다.
