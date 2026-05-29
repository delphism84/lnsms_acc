# setid · sync bundle 규격

> Agent FE, agent-host, lnsms-be, lnsms-admin-fe 공통.  
> **변경 시 이 문서를 먼저 수정**한 뒤 각 패키지에 반영한다.

---

## 1. URL (서브패스)

| 구분 | UI | API |
|------|-----|-----|
| Platform | `/platform` | `/api/platform/*` |
| Store | `/s/{agentId}/{storeId}/*` | `/api/s/{agentId}/{storeId}/*` |

---

## 2. setid 설정 (에이전트)

- 세트 문서: `set_configs` 컬렉션 (`setid`, `userid`, `phrases`, `serial`).
- **setid-first**: 동기화·에이전트 런타임은 `setid` 문자열을 기준 키로 한다. `userid`는 매장(storeId) 스코프.
- Agent 다운로드/업로드: Platform sync 또는 scoped `GET|PUT /api/s/.../sets` (전환 중).
- 상세 필드: legacy `lunar-agent-acc-web/req/req1/setid.md` 참고.

### 2.1 set_configs 문서 (요약)

| 필드 | 타입 | 설명 |
|------|------|------|
| `setid` | string | 세트 식별자 (유니크 키, 에이전트 기준) |
| `userid` | string | 매장 storeId (`Store.storeId` / `userid`) |
| `phrases` | object | 버튼·문구 매핑 |
| `serial` | object | 시리얼 포트·프로토콜 설정 |

---

## 3. Store sync bundle (DB 동기화 단위)

**한 매장** 단위 export/import. 에이전트 런타임(실시간 serial RX 큐)은 포함하지 않는다.

### 3.1 Bundle 최상위 (`version` 1)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `version` | number | ✓ | 현재 `1` |
| `agentId` | string | ✓ | 에이전트 ID |
| `storeId` | string | ✓ | 매장 ID (문자열) |
| `storeRef` | string | ✓ | Mongo `stores._id` (ObjectId hex) |
| `exportedAt` | string (ISO-8601) | ✓ | export 시각 |
| `store` | object | ✓ | `stores` 문서 스냅샷 |
| `collections` | object | ✓ | 하위 컬렉션 배열 (아래) |
| `files` | array | ✓ | 업로드 파일 메타 (1차는 `[]` 가능) |

### 3.2 `collections` (setid-first 규칙)

| 키 | Mongo 컬렉션 | 스코프 | import 시 |
|----|--------------|--------|-----------|
| `categories` | `categories` | `storeId` = `storeRef` | replace 시 삭제 후 삽입 |
| `menus` | `menus` | `storeId` = `storeRef` | 동일 |
| `devices` | `eqids` | `storeRef` / `storeIdLegacy` | 동일 |
| `set_configs` | `set_configs` | **`userid` = 매장 `storeId`** | replace 시 `userid`로 삭제 후 삽입; import 시 `userid`를 대상 매장으로 **강제** |

- export 키는 **`set_configs`** (camelCase `setConfigs`는 호환만).
- import는 `set_configs`를 **대상 매장의 `storeId`/`userid`로 재매핑**한다 (`_id`는 재생성).

### 3.3 Export 예시 (`POST /api/platform/sync/export`)

```json
{
  "version": 1,
  "agentId": "agent-001",
  "storeId": "store-001",
  "storeRef": "507f1f77bcf86cd799439011",
  "exportedAt": "2026-05-29T12:00:00.000Z",
  "store": { "_id": "507f1f77bcf86cd799439011", "name": "매장A" },
  "collections": {
    "categories": [],
    "menus": [],
    "devices": [],
    "set_configs": [
      { "setid": "set-01", "userid": "store-001", "phrases": {}, "serial": {} }
    ]
  },
  "files": [
    { "path": "uploads/abc.png", "sha256": "…", "contentType": "image/png" }
  ]
}
```

### 3.4 Import 요청 (`POST /api/platform/sync/import`)

```json
{
  "agentId": "agent-001",
  "storeId": "store-001",
  "mode": "replace",
  "bundle": { }
}
```

| 필드 | 설명 |
|------|------|
| `mode` | `replace` (기본): 해당 매장의 categories/menus/devices/set_configs 삭제 후 bundle 삽입 |
| `mode` | `merge`: 추후 (LWW·버전 비교) |

**replace 동작 (BE)**

1. `storeRef`로 categories, menus, devices 삭제  
2. `userid` (= 대상 `storeId`)로 `set_configs` 삭제  
3. bundle `collections` 삽입 (`_id` 제거, `storeId`/`storeRef`/`userid` 재설정)

### 3.5 `files[]` 항목 (1차 메타만)

| 필드 | 설명 |
|------|------|
| `path` | 업로드 디렉터리 기준 상대 경로 |
| `sha256` | 무결성 검증용 |
| `contentType` | MIME |

2차: tar 바이너리 또는 presigned URL로 바이너리 동기화.

---

## 4. Store scoped API (FE)

- `createStoreApi(agentId, storeId)` → `/api/s/{agentId}/{storeId}/*`
- 컨텍스트: `GET /context` (매장 문서 포함), `PUT /context`, `PUT /context/password`

---

## 5. 충돌

- 1차: import 시 `replace`만 (서버/로컬 덮어쓰기 명시).
- 2차: `bundleVersion` / `updatedAt` LWW.

---

## 6. 로컬 단일 매장 (admin-fe)

`.env.local`:

```env
NEXT_PUBLIC_STORE_AGENT_ID=your-agent
NEXT_PUBLIC_STORE_STORE_ID=your-store
```

설정 시 `/` → `/s/{agentId}/{storeId}/setting` 리다이렉트.
