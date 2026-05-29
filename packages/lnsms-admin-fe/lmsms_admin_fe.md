# lnsms-admin-fe 설계 (Admin Dashboard, WS-only)

> 기준 문서: `/var/lnsms/lnsms_be/lnsms_be.md` (WS-only + MongoDB)
>
> 목적: Admin UI(웹)에서 **모든 설정/관리 기능을 WebSocket으로만** 수행하고, 서버의 구독/푸시 이벤트로 **실시간 동기화**되는 관리자 대시보드를 설계한다.

---

## 1) 목표/범위

### 목표
- **WS-only**: REST 호출 없이 WebSocket으로만 조회/변경/파일전송 수행
- **멀티 스코프 지원**: `agentId / userId / eqId` 기준으로 조회/편집/구독 범위 전환
- **실시간 동기화**: 설정 변경 시 `*.changed` 이벤트를 구독해 화면 자동 갱신
- **충돌 안전**: 문서 `version` 기반 낙관적 락 충돌(`CONFLICT`) UX 제공
- **운영 친화**: 재연결/재구독/오프라인 안내(읽기 전용 모드 등) 기본 제공

### 비목표(초기)
- 고도화된 SSO/OAuth, 조직/역할 기반 권한 모델의 완성형
- 대규모 멀티테넌트 클러스터(샤딩)용 운영 도구

---

## 2) 배포/접속(환경)

### 포트 정책(권장)
- BE: `60000` (WS)
- Admin FE: `60001` (정적 서빙 또는 dev 서버)
- nginx에서 `/` → FE, `/api/` 또는 `/ws` → BE 프록시 가능

### 환경 변수(예시)
- `VITE_WS_URL` 또는 `NEXT_PUBLIC_WS_URL`: `wss://<domain>/ws` 또는 `ws://127.0.0.1:60000`
- `VITE_DEFAULT_AGENT_ID` (옵션)

> 운영은 `wss://` + 정상 인증서 권장. (모바일 앱/브라우저 호환성 및 보안)

---

## 3) 기술 스택(권장)

### 프레임워크
- **React + TypeScript**
- 빌드 도구: Vite(권장) 또는 Next.js(필요 시 SSR)

### UI
- **MUI(Material UI)** 권장: 기본 컴포넌트/간격/타이포를 우선 사용
- 디자인 값(높이/패딩/폰트 등)은 **불필요한 하드코딩을 지양**하고, 기본 테마/스페이싱을 기본으로 한다.

### 상태관리/데이터
- 서버 상태: TanStack Query(선택) 또는 Redux Toolkit(선택)
- WS 이벤트 기반이므로 “쿼리 캐시 + 이벤트로 invalidate/patch” 패턴 권장

---

## 4) 정보구조(IA) / 화면 구성

### 전역 레이아웃
- 상단 AppBar
  - 좌측: 앱 이름/환경 표시
  - 중앙: 현재 스코프 표시(Agent/User/Eq)
  - 우측: 연결 상태(Online/Reconnecting/Offline), 사용자 메뉴(로그아웃)
- 좌측 Navigation Drawer
  - Dashboard
  - System Settings
  - Phrases (벨코드/문구)
  - Serial
  - TTS
  - History
  - (선택) Bell Monitor(실시간 수신/재송신 관찰)
  - (선택) Files(이미지/CSV 동기화 관리)

### 4.1 Dashboard
- 현재 스코프 요약 카드
  - 연결 상태/최근 재연결 시간
  - 구독 토픽 목록
  - 마지막 변경 이벤트(타입/시각/버전)
- 알림(벨) 실시간 패널(옵션)
  - 최근 N개 `notification.received` 로그
  - 필터: bellCode, registered 여부, origin(serial/server-resend)

### 4.2 Scope Switcher(중요)
- agentId 선택(필수)
- userId 선택(옵션, agentId 하위)
- eqId 선택(옵션, userId 하위)
- 스코프 전환 시 동작
  - 구독 재설정(`subscribe` 재전송)
  - 각 화면의 데이터 재조회(get/list)
  - 편집 중 변경사항이 있으면 경고(unsaved changes)

### 4.3 System Settings
- 조회: `systemSettings.get`
- 수정: `systemSettings.update`
- 알림 이미지 업로드(REST 금지 대응)
  - `systemSettings.notificationImage.upload.init / chunk / commit` 또는 공통 `file.upload.*`로 통일(구현 결정)

### 4.4 Phrases (문구/벨코드)
- 리스트: `phrases.list`
- 생성/수정/삭제: `phrases.create / update / delete`
- 제약 UX
  - `uid=90000001` 삭제/생성 금지
  - `crcv.assist`는 기본 문구에만 허용
  - bellCodes 정규화(trim+lower), 중복 제거
  - bellCodes는 전체 Phrase에서 유일(중복 할당 불가) → 충돌 시 명확한 에러 표시
- 재송신 설정 UI
  - `resendEnabled` 토글
  - `resendAudience.allow` 편집기
    - agentId 단위 선택(기본 자기 agentId)
    - userId: 전체(*) 또는 일부 선택
    - eqId: 전체(*) 또는 일부 선택

### 4.5 Serial
- 포트 목록: `serial.ports.list`
- 상태: `serial.status.get`
- 설정: `serial.settings.get / update`
- 연결 제어: `serial.connect / disconnect / reconnect`
- 로그: `serial.log.latest.get`, `serial.log.enabled.set`
- 이벤트 구독
  - `serial.status.changed`, `serial.rx`(필요 시)

### 4.6 TTS
- `tts.enabled.get / set`
- 테스트 발화: `tts.speak`
- 이벤트: `tts.enabled.changed`

### 4.7 History
- 내보내기 요청: `history.export.request`
- 결과 수신: `history.export.result`
- 파일 전달(REST 금지)
  - (권장) WS로 `file.download` 같은 청크 다운로드 프로토콜
  - (대안) 단일 PC 환경이면 서버 로컬 경로 반환 후 “동기화된 로컬 파일”을 열람

---

## 5) WS 프로토콜 사용(클라이언트 설계)

### 5.1 공통 Envelope
- 요청은 항상 `{ v, id, type, ts, meta, payload }`
- 응답은 `{ v, id, type: "<req>.res", ok, payload | error }`

### 5.2 연결/핸드셰이크
- 연결 직후 `hello` 전송
  - `clientType: "admin-ui"`
  - `clientVersion`
  - `instanceId`(브라우저 탭 단위 UUID 권장)
  - `auth`(token 또는 id/pw 기반 로그인 결과)

### 5.3 구독(subscribe)
- 로그인/스코프 확정 후 `subscribe` 전송
  - `topics`: `["systemSettings","phrases","serial","notifications","tts","bell"]`
  - `scope`: `{ agentId, userId?, eqId? }`

### 5.4 재연결 전략(필수)
- 지수 백오프 + 최대 대기 제한
- 재연결 후 자동 수행
  - `hello` 재전송
  - `subscribe` 재전송
  - 화면 데이터 re-sync(get/list 재호출)
- 네트워크 오프라인 감지 시 UI 배너 표시 및 편집 제한(선택)

---

## 6) 인증/세션(결정 사항 반영)

문서 기준: **agentId, userId, pw로 인증**.

### 권장 흐름
- 로그인 화면에서 `agentId/userId/password` 입력
- WS로 `auth.login`(추가 정의 필요) 요청
- 성공 시 서버가 `token` 발급(권장) 또는 세션 바인딩
- FE는 토큰을 메모리 또는 안전한 저장소에 보관(보안 정책에 따라)

> 현재 BE 문서에는 `auth.login` 타입 정의가 없으므로, FE 문서에서는 “추가 필요 메시지”로 정의한다.

---

## 7) 데이터 모델(프론트 타입)

### 공통
- `agentId: string`
- `userId?: string`
- `eqId?: string`
- `version: number`
- `updatedAt: string(ISO)`

### SystemSettings(예시)
- `enabled`, `enabledRecursive`
- `appName`, `notificationTitle`, `notificationDefaultMessage`, `notificationImageAltText`
- `notificationImage?: { fileId, contentType, sha256?, updatedAt }`

### Phrase(예시)
- `uid: string` (기본 `90000001`)
- `text: string`
- `isEnabled: boolean`
- `color: string`
- `bellCodes: string[]`
- `autoAckEnabled: boolean`, `autoAckSeconds: number`
- `resendEnabled: boolean`
- `resendAudience: { allow: Array<{ agentId, users: Array<{ userId: string, eqs: string[] }> }> }`

---

## 8) 에러/검증 UX 규칙

### 서버 에러 공통 표시
- `VALIDATION_ERROR`: 필드별 메시지 + 입력 강조
- `CONFLICT`: “다른 곳에서 변경됨” 안내 + 선택지
  - 내 변경 덮어쓰기(서버 정책 허용 시)
  - 최신값으로 새로고침 후 재시도

### 제약(대표)
- `crcv.assist`는 기본 문구에만 할당
- 기본 문구 삭제 불가
- bellCodes 전역 유일(중복 할당 불가)

---

## 9) 파일 업로드(REST 없이)

### 기본: WS 청크 업로드
- `file.upload.init` → `uploadId`
- `file.upload.chunk` (index/offset 기반)
- `file.upload.commit` → `fileId`

### 화면
- SystemSettings 알림 이미지 업로드
- Phrase 이미지 업로드
- 진행률/재시도/취소(선택)

---

## 10) 운영/개발 편의

### 로깅(클라이언트)
- WS 연결 상태 변화 로그
- 마지막 처리한 메시지 `id/type/ok`
- (개발 모드) raw 메시지 디버그 패널(선택)

### 테스트 시나리오(최소)
- 연결/재연결/재구독
- 스코프 전환 시 데이터/구독 정상 동작
- phrases 제약 검증(기본 uid, crcv.assist, bellCodes 유일)
- version 충돌(CONFLICT) 처리 UX
- 파일 업로드(청크) 1회 성공

---

## 11) FE 구현 산출물(리포 구조 제안)

> `lnsms_admin_fe` 리포가 비어있다면, 아래 구조로 시작 권장.

- `src/`
  - `app/` (라우팅/레이아웃)
  - `features/`
    - `auth/`
    - `scope/`
    - `systemSettings/`
    - `phrases/`
    - `serial/`
    - `tts/`
    - `history/`
  - `shared/`
    - `ws/` (WS client, reconnect, request/response correlation)
    - `types/` (envelope + domain types)
    - `ui/` (공용 컴포넌트)

