# lnsms_acc — LNSMS monorepo

Platform(전체 매장) + Store site(단일 매장) + Agent Host(시리얼·알림)를 **한 리포**에서 운영합니다.

## 구조

```
packages/
  lnsms-be/          # Node API (Platform + Store, Mongo)
  lnsms-admin-fe/    # Next.js Admin + 매장 콘솔
  agent-host/        # CareReceiverAgent.Host (Kestrel :58000, WebView)
resource/            # app.json, icons
deploy/              # docker-compose, nginx 예시
scripts/             # 로컬 기동 스크립트
docs/                # 아키텍처, sync bundle, agent 스택
data/mongo/          # 로컬 external Mongo (git 제외)
```

## 서버 운영 (목표)

서버에 **동일 BE + FE**를 배포해 Admin site를 운영합니다.

```bash
# deploy/docker-compose.yml — mongo + lnsms-be + lnsms-admin-fe
cd deploy && docker compose up -d
```

- Platform: `https://your-host/platform`
- 매장 콘솔: `https://your-host/s/{agentId}/{storeId}/setting`

## 로컬 개발

[dev.md](dev.md) · [docs/agent-local-stack.md](docs/agent-local-stack.md)

```powershell
.\scripts\dev-agent.ps1          # mongod + BE + FE
cd packages\agent-host && dotnet run   # + Agent :58000
```

## 데이터 동기화 (로컬 ↔ 서버)

| 방향 | API (같은 BE 인스턴스 기준) | UI |
|------|-----------------------------|-----|
| 서버 DB 스냅샷보내기 | `POST /api/platform/sync/export` | `/platform` → Export JSON |
| 서버 DB에 반영 | `POST /api/platform/sync/import` (replace) | `/platform` → Import JSON |
| 매장 편집 (실시간) | `GET/POST /api/s/{agentId}/{storeId}/...` | Store setting — **연결된 Mongo에 즉시 반영** |

**로컬 → 원격 서버** 한 번에 올리려면: 로컬에서 export → 원격 URL로 import (또는 매장 UI에 원격 sync 버튼 추가 — [plan.md](plan.md) Step D).

**원격 → 로컬** 은 반대로: 원격 export → 로컬 import.

`files[]`(업로드 미디어)는 bundle 1차에 메타만 포함 — 바이너리 동기는 별도 단계.

## API 요약

- Platform: `/api/platform/*`, sync: `/api/platform/sync/export|import`
- Store: `/api/s/:agentId/:storeId/*`
- Agent: `http://localhost:58000` (시리얼·알림·설정)

상세: [docs/setid.md](docs/setid.md), [plan.md](plan.md)
