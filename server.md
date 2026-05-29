# 서버 배포·운영 지침

운영 서버에서 **Admin site(Platform + 매장 콘솔)** 를 띄우고, 매장 PC(Agent)와 **DB 동기화**까지 연결하는 절차입니다.

리포: https://github.com/delphism84/lnsms_acc

---

## 1. 서버에서 담당하는 역할

| 구성요소 | 포트(내부) | 역할 |
|----------|------------|------|
| **MongoDB** | 27017 | 매장·카테고리·메뉴·기기·set_configs 영구 저장 |
| **lnsms-be** | 40000 | REST API (`/api/platform/*`, `/api/s/.../*`, sync) |
| **lnsms-admin-fe** | 63001 | Next.js UI (`/platform`, `/s/.../setting`) |
| **nginx** (권장) | 80/443 | HTTPS, `/api`·`/uploads` → BE, 나머지 → FE |

매장 PC의 **Agent Host(:58000)** 는 서버에 올리지 않아도 됩니다. Agent는 로컬에서 시리얼·알림만 처리하고, 데이터는 **서버 DB 동기화** 또는 Platform에서 직접 편집합니다.

---

## 2. 사전 요구사항

- OS: Linux(권장) 또는 Windows Server
- **Node.js 18+** (BE·FE 빌드/실행)
- **MongoDB 7** (또는 Docker `mongo:7`)
- **nginx** (또는 동등 리버스 프록시)
- 디스크: Mongo data + `packages/lnsms-be/uploads/` (미디어 업로드)
- 방화벽: 외부에는 **443(또는 80)** 만 개방. 27017/40000/63001은 localhost 또는 내부망만

---

## 3. 코드 배치

```bash
git clone https://github.com/delphism84/lnsms_acc.git
cd lnsms_acc
```

디렉터리 예:

```
/opt/lnsms_acc/
  packages/lnsms-be/
  packages/lnsms-admin-fe/
  deploy/
```

---

## 4. MongoDB

### 4.1 전용 DB·사용자 (권장)

```bash
mongosh
use lnsms
db.createUser({
  user: "lnsms",
  pwd: "<strong-password>",
  roles: [{ role: "readWrite", db: "lnsms" }]
})
```

연결 문자열:

```
mongodb://lnsms:<password>@127.0.0.1:27017/lnsms?authSource=lnsms
```

### 4.2 데이터 디렉터리

- 예: `/var/lib/mongodb` 또는 Docker volume `lnsms_mongo`
- **백업 대상**: 이 DB 전체 + BE `uploads/` 폴더

---

## 5. 백엔드 (lnsms-be)

### 5.1 설치

```bash
cd packages/lnsms-be
npm ci --omit=dev
```

### 5.2 환경 변수

`packages/lnsms-be/.env` (서버 전용, git에 올리지 않음):

```env
PORT=40000
MONGODB_URI=mongodb://lnsms:<password>@127.0.0.1:27017/lnsms?authSource=lnsms
UPLOAD_DIR=/var/lnsms/uploads
```

| 변수 | 설명 |
|------|------|
| `PORT` | **40000** 고정 권장 (문서·FE와 일치) |
| `MONGODB_URI` | **`memory` 사용 금지** (운영) |
| `UPLOAD_DIR` | tus/파일 업로드 저장 경로 (백업 포함) |

### 5.3 기동·헬스체크

```bash
npm start
# 또는 systemd / pm2
curl -s http://127.0.0.1:40000/health
```

정상이면 JSON 응답. 실패 시 Mongo 연결·포트 충돌을 확인합니다.

### 5.4 systemd 예시

`/etc/systemd/system/lnsms-be.service`:

```ini
[Unit]
Description=LNSMS Backend
After=network.target mongod.service

[Service]
Type=simple
WorkingDirectory=/opt/lnsms_acc/packages/lnsms-be
EnvironmentFile=/opt/lnsms_acc/packages/lnsms-be/.env
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
User=lnsms

[Install]
WantedBy=multi-user.target
```

---

## 6. 프론트엔드 (lnsms-admin-fe)

### 6.1 빌드

```bash
cd packages/lnsms-admin-fe
npm ci
npm run build
```

### 6.2 환경 변수 (빌드·런타임)

`packages/lnsms-admin-fe/.env.production` 또는 systemd `Environment=`:

```env
# 브라우저가 API를 부를 때 쓰는 공개 URL (nginx 뒤 도메인)
NEXT_PUBLIC_API_URL=https://admin.example.com

# Next 서버( rewrites + /api/sync/* )가 BE를 호출할 내부 주소
API_PROXY_TARGET=http://127.0.0.1:40000

# (선택) 매장 setting 동기화 패널 기본 원격 URL — 보통 공개 URL과 동일
LNSMS_SYNC_SERVER_URL=https://admin.example.com
NEXT_PUBLIC_LNSMS_SYNC_SERVER_URL=https://admin.example.com

NODE_ENV=production
```

**중요**

- `NEXT_PUBLIC_API_URL`은 **사용자 브라우저 기준** URL (대개 `https://도메인`, 포트 443).
- `API_PROXY_TARGET`은 **서버 내부**에서 BE에 닿는 주소 (`http://127.0.0.1:40000`).
- nginx가 `/api`를 BE로 넘기면, 공개 URL과 내부 프록시가 같아 보이게 맞춥니다.

### 6.3 기동

```bash
npm run start
# 포트 63001
```

### 6.4 systemd 예시

`/etc/systemd/system/lnsms-admin-fe.service`:

```ini
[Unit]
Description=LNSMS Admin FE
After=lnsms-be.service

[Service]
Type=simple
WorkingDirectory=/opt/lnsms_acc/packages/lnsms-admin-fe
Environment=NEXT_PUBLIC_API_URL=https://admin.example.com
Environment=API_PROXY_TARGET=http://127.0.0.1:40000
Environment=LNSMS_SYNC_SERVER_URL=https://admin.example.com
ExecStart=/usr/bin/npm run start
Restart=on-failure
User=lnsms

[Install]
WantedBy=multi-user.target
```

---

## 7. nginx (리버스 프록시)

`deploy/nginx.conf.example` 참고. 요약:

| 경로 | upstream |
|------|----------|
| `/api/` | `127.0.0.1:40000` |
| `/uploads/` | `127.0.0.1:40000` |
| `/health` | `127.0.0.1:40000` |
| `/` (UI) | `127.0.0.1:63001` |

- `client_max_body_size` — 대용량 업로드(수백 MB) 허용
- HTTPS: certbot 등으로 443 설정 후 `X-Forwarded-Proto` 전달

적용 후 확인:

```bash
curl -s https://admin.example.com/health
curl -sI https://admin.example.com/platform
```

---

## 8. Docker Compose (선택)

```bash
cd deploy
docker compose up -d --build
```

- `mongo`, `lnsms-be`는 compose에 정의됨.
- **FE**는 프로덕션용 Dockerfile이 없을 수 있음 → 위 **6절**처럼 호스트에서 `npm run build && npm start` 하고 nginx만 Docker 밖에서 두는 구성이 안전합니다.
- BE 이미지 기본 `EXPOSE`는 3000이지만 **환경 변수 `PORT=40000`** 으로 맞춥니다.

---

## 9. 최초 운영 설정 (Admin)

1. 브라우저: `https://admin.example.com/login`
2. Platform: `https://admin.example.com/platform`
3. **매장(Store) 생성** — `agentId`, `storeId` 확정 (Agent `app.json`의 `qaUserId`/`qaStoreId`와 맞출 것)
4. 매장 콘솔: `https://admin.example.com/s/{agentId}/{storeId}/setting`
5. 카테고리·메뉴·기기(EQID) 편집 → **즉시 서버 Mongo에 저장** (별도 sync 불필요)

Platform 화면에서 JSON **Export/Import**로 수동 백업·이전도 가능합니다.

---

## 10. 매장 PC ↔ 서버 DB 동기화

매장 PC에서 로컬 스택(`dev-agent.ps1` 또는 Agent `LocalStack`)으로 편집한 뒤 서버에 반영할 때:

1. 로컬 매장 setting: `http://127.0.0.1:63001/s/{agentId}/{storeId}/setting`
2. **서버 DB 동기화** 패널
3. **운영 서버 API 베이스** = `https://admin.example.com` (nginx 공개 URL, `/api` 포함하지 않음)
4. **서버로 업로드** → 로컬 BE export → 서버 BE import (replace)

반대(**서버에서 다운로드**)는 서버 데이터를 로컬 Mongo로 가져옵니다.

동작 조건:

- 서버 BE가 기동 중이고 `/api/platform/sync/*` 접근 가능
- 로컬 FE의 `API_PROXY_TARGET`이 로컬 BE를 가리킴
- Next `/api/sync/upload|download`는 **FE 프로세스**에서 실행되므로, 로컬 개발 시에만 동작하고 **운영 서버 FE에서는 로컬 PC가 아닌 서버 자신**을 기준으로 호출하지 않도록 주의 (동기화 UI는 **매장 PC**에서 사용)

**포함 데이터**: `categories`, `menus`, `devices`, `set_configs`  
**미포함**: `uploads/` 실제 파일 — 서버·로컬 간 미디어는 rsync 또는 동일 `UPLOAD_DIR` 공유로 별도 맞춤

---

## 11. Agent(매장 PC) 연동

서버에 Agent를 올리지 않습니다. 매장 PC:

```powershell
cd packages\agent-host
dotnet run
```

`resource/app.json` (또는 배포본 `app.json`):

```json
{
  "lnsmsApiBase": "http://127.0.0.1:40000",
  "lnsmsUiBase": "http://127.0.0.1:63001",
  "qaUserId": "<platform과 동일 agentId>",
  "qaStoreId": "<platform과 동일 storeId>",
  "localStackEnabled": true,
  "repoRoot": "C:\\path\\to\\lnsms_acc"
}
```

- WebView: 로컬 매장 setting
- 시리얼·알림: `:58000`
- 서버 반영: setting 화면 **서버로 업로드** 또는 Platform에서 직접 편집

원격 세트 업로드(레거시): Agent `LnsmsRemoteUploadBase` — 운영 URL의 sets API (bundle sync와 별도)

---

## 12. 백업·복구

| 대상 | 방법 |
|------|------|
| Mongo | `mongodump` / `mongorestore` (DB `lnsms`) |
| 업로드 파일 | `UPLOAD_DIR` 디렉터리 rsync·스냅샷 |
| 매장 단위 | Platform Export JSON 보관 |

복구 후 BE 재시작 → `/health` 확인.

---

## 13. 배포·업데이트

```bash
cd /opt/lnsms_acc
git pull origin main

# BE
cd packages/lnsms-be && npm ci --omit=dev
sudo systemctl restart lnsms-be

# FE
cd packages/lnsms-admin-fe && npm ci && npm run build
sudo systemctl restart lnsms-admin-fe
```

- 스키마 마이그레이션: BE 기동 시 일부 필드 자동 보정 (`index.js`)
- 다운타임 최소화: BE → FE 순 재기동

---

## 14. 점검 체크리스트

- [ ] `curl https://<host>/health` OK
- [ ] `/platform` 로그인·매장 목록
- [ ] `/s/{agentId}/{storeId}/setting` CRUD 저장·새로고침 유지
- [ ] 파일 업로드 후 `/uploads/...` URL 접근
- [ ] Mongo·uploads 백업 cron 등록
- [ ] 27017 외부 차단
- [ ] HTTPS 적용

---

## 15. 장애 대응

| 증상 | 확인 |
|------|------|
| API 404 HTML | nginx가 `/api`를 FE로 보냄 → BE upstream 수정 |
| FE에서 JSON parse error | `NEXT_PUBLIC_API_URL`이 FE 자신을 가리킴 → 공개 도메인으로 수정 |
| sync 업로드 실패 | 서버 URL·방화벽·서버 BE 로그; 매장 PC에서 실행했는지 |
| 업로드 파일 404 | `UPLOAD_DIR` 권한·nginx `/uploads` 프록시 |
| Mongo 연결 실패 | `MONGODB_URI`, authSource, mongod 기동 |

---

## 16. 관련 문서

- [dev.md](dev.md) — 로컬 개발
- [docs/agent-local-stack.md](docs/agent-local-stack.md) — Agent + 로컬 스택
- [docs/setid.md](docs/setid.md) — sync bundle 스키마
- [deploy/nginx.conf.example](deploy/nginx.conf.example)
- [deploy/docker-compose.yml](deploy/docker-compose.yml)
