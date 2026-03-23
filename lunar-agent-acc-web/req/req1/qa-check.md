# QA 검수 가이드 (호출밸 호출 → BE 연동)

## 실행 시 필백

- **app.json** `qaEnabled: true`(기본)이면, 실행 시 문구가 5개 미만일 때 **QA용 기초 데이터**를 자동 시드합니다.
- 시드 내용:
  - **유저 ID**: `qaUserId` (기본 `qa-user-001`)
  - **매장 ID**: `qaStoreId` (기본 `qa-store-001`)
  - **호출벨 5개 등록**: 문구 5개 (crcv.assist, qa.1, qa.2, qa.3, qa.4) + 문구 텍스트·색상

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/qa/config | QA 설정·시드된 호출벨 코드 조회 (qaUserId, qaStoreId, qaBellCodes) |
| POST | /api/qa/simulate-rx | 시리얼 RX 강제 호출 (body: `{ "bellCode": "qa.1" }` 등) |
| POST | /api/serialport/simulate-rx | 원시 라인 주입 (body: `{ "line": "00000000.bell=qa.1", "appendCarriageReturn": true }`) |

## 검수 절차 (호출밸 호출 → BE 연동)

1. **앱 실행** (일반/Headless/서비스)
   - 문구가 비어 있으면 자동으로 호출벨 5개·문구 시드.

2. **기초 정보 확인**
   ```http
   GET http://localhost:58000/api/qa/config
   GET http://localhost:58000/api/phrases
   ```
   - `qaUserId`, `qaStoreId`, `qaBellCodes` 5개 확인.
   - `phrases` 배열에 5개 문구(도와주세요, QA 호출 1~4) 확인.

3. **시리얼 RX 시뮬레이션 (호출벨 호출)**
   ```http
   POST http://localhost:58000/api/qa/simulate-rx
   Content-Type: application/json
   { "bellCode": "qa.1" }
   ```
   - `bellCode` 예: `crcv.assist`, `qa.1`, `qa.2`, `qa.3`, `qa.4`

4. **알림 연동 확인**
   ```http
   GET http://localhost:58000/api/notifications/active
   ```
   - `notifications`에 해당 문구(uid, message, color)가 들어오면 BE 연동 정상.

5. **(선택) 여러 번 호출 → 큐·일괄확인**
   - `simulate-rx`를 여러 번 호출 후 `notifications/active`에서 큐/일괄확인 동작 확인.
