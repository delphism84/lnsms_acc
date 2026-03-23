# QA E2E 검증: Node 시드 + .NET 봇

## 1. Node QA 봇 (userid-storeid-setid 1개 필백)

- **스크립트**: `backend/scripts/qa-seed.js`
- **실행**: `cd backend && node scripts/qa-seed.js` 또는 `npm run qa-seed`
- **동작**: LNSMS BE(기본 http://localhost:60000)에 다음 생성
  - **user**: `qa-user-001` / `qa-pw-001`
  - **store**: `qa-store-001` (userid: qa-user-001)
  - **set**: `qa-set-001` (storeid: qa-store-001)
  - **세트 설정**: 문구 2개 (도와주세요/crcv.assist, QA 호출 1/qa.1), serial.ports: []

## 2. .NET 봇 (구동 → 로그인 → 내려받기 → RX 시뮬레이션 → 알림)

- **엔드포인트**: `POST /api/qa/bot-run`
- **설정**: `app.json` (또는 기본값) `LnsmsApiBase`: `http://localhost:60000`
- **동작 순서**:
  1. LNSMS `POST /api/auth/login` (admin/admin)
  2. LNSMS `GET /api/sets` → 첫 번째 setid 사용
  3. LNSMS `GET /api/sets/{setid}/config`
  4. 에이전트 `POST /api/settingsapply` (setid, phrases, serial)
  5. 에이전트 `POST /api/qa/simulate-rx` (bellCode: crcv.assist)
- **결과**: 알림 큐에 해당 문구(도와주세요) 등록 → `GET /api/notifications/active`로 확인

## 3. 검증 실행 (2026-03-04)

1. **Kill**: node 프로세스, CareReceiverAgent.Host 종료
2. **Node BE 기동**: `PORT=60000 node src/index.js` (backend)
3. **QA 시드**: `node scripts/qa-seed.js` → qa-user-001, qa-store-001, qa-set-001 필백 완료
4. **.NET 에이전트 기동**: `CareReceiverAgent.Host.exe --headless` (실제 포트: 58002)
5. **봇 실행**: `POST http://localhost:58002/api/qa/bot-run` → `{ "success": true, "setid": "a", "bellCode": "crcv.assist" }`
6. **알림 확인**: `GET http://localhost:58002/api/notifications/active` → notifications[0]: uid 90000001, message "도와주세요", color #FF0000

**결론**: 로그인 → 다운로드 → 적용 → RX 시뮬레이션 → 알림 발생까지 E2E 정상 동작 확인.
