# LUNARNET · LunarMsg (Final)

> **WS = 실시간 이벤트 터널만.** CRUD·조회·sync·upload = **REST** — [plan.md](plan.md)  
> **userid** = 업체 ID · **storeId** = 매장 ID · StoreKey = `` `{userid}.{storeId}` ``

---

## 1. 역할

| | REST | WS |
|---|------|-----|
| CRUD / list / get | ✅ `/api/store/{userid}/{storeId}/…` | ❌ |
| sync export/import | ✅ Host `/api/host/…/sync/*` only | ❌ |
| upload (tus) | ✅ Host REST | `EVT.upload.done` 알림만 |
| bell | ACK optional | ✅ ingest, resend |
| UI 실시간 갱신 | REST refetch | ✅ `EVT.changed` |

---

## 2. 프레임

```json
{
  "v": 1,
  "trid": "1738167123456000042",
  "sender": "vendor-a.shop-01.eq-001.inbox:inbox.7f3a2c.client:pc-agent",
  "dest": "vendor-a.shop-01.*.broadcast:store",
  "topic": "lnsms.store.vendor-a.shop-01.categories",
  "tag": "EVT.changed",
  "msg": { "action": "update", "id": "…" }
}
```

| 필드 | 용도 |
|------|------|
| `trid` | `{utcMillis13}{seq6}` |
| `sender` / `dest` / `topic` / `tag` | 4중 라우팅 (디버그) |

---

## 3. WS topic (실시간만)

```
lnsms.session                          hello, listen, ping
lnsms.bell                             ingest, resend
lnsms.store.{userid}.{storeId}.categories   EVT.changed
lnsms.store.{userid}.{storeId}.menus        EVT.changed
lnsms.store.{userid}.{storeId}.devices      EVT.changed
lnsms.store.{userid}.{storeId}.sets         EVT.changed
lnsms.store.{userid}.{storeId}.upload       EVT.upload.done
```

**REQ.list / REQ.create 등 Store CRUD tag 없음.**

---

## 4. tag (WS)

| kind | op | 용도 |
|------|-----|------|
| REQ | hello, listen, ping | 세션 |
| REP | hello, pong | 응답 |
| REQ | ingest | bell → server |
| EVT | resend | server → eq |
| EVT | changed | REST CRUD 후 fan-out |
| EVT | upload.done | tus 완료 |
| ERR | * | 오류 |

---

## 5. bell

- **ingest:** `REQ.ingest`, `msg.eventId` = `trid`
- **resend:** `EVT.resend`, 동일 StoreKey **전 eq**
- **디바운스:** eq별 동일 `eventId` **2회째~5초 무시**
- **큐:** 5초 내 ingest 재전송
- **Mongo:** `bell_events`

---

## 6. 클라이언트 WS 사용법

1. `hello` + JWT (`aud=platform` \| `aud=host`)
2. `listen` — `lnsms.store.{userid}.{storeId}.>`, `lnsms.bell.>`
3. **데이터 로드** → REST GET
4. **편집** → REST POST/PUT/DELETE
5. **`EVT.changed`** 수신 → REST refetch (또는 msg.payload patch)

Admin: `/s/...` **페이지 진입 시** connect (D1).  
Agent: **상시** connect (bell).

---

## 7. REST (참고 — WS 아님)

Store CRUD: `/api/store/{userid}/{storeId}/…`  
Host: auth, password, tus, sync — plan.md §4.

Platform: **sync export/import API 없음.**

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-29 | Final: WS=이벤트 터널, CRUD=REST |
