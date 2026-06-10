# lnvoice — 다자간 통화 사이트 기획서 (req_final)

> **대상 브라우저:** Chrome (최신 2버전 기준)  
> **목표:** ID만으로 로그인 → 로비에서 방 선택 → WebRTC 기반 다자간 음성/영상 통화 + 텍스트 채팅  
> **문서 버전:** 1.0 · 2026-05-20

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | **lnvoice** |
| 한 줄 정의 | 브라우저(Chrome)에서 동작하는 다자간 음성·영상 통화 + 채팅 웹앱 |
| 인증 | **ID 입력만** (비밀번호 없음, 데모/내부용 수준) |
| 핵심 기술 | WebRTC, WebSocket 시그널링, Vite + React, Node.js |

### 1.1 비기능 요구사항

- **HTTPS** 필수 (로컬은 `localhost` 예외). 마이크/카메라는 Secure Context에서만 동작.
- **Chrome 우선** 개발·테스트. Safari/Firefox는 2차(선택).
- 초기 동시 접속: 방당 **최대 8명** (로비 UI 2×4와 정합).
- 반응형: **모바일 1차 미지원**, 데스크톱·태블릿 가로 기준(최소 너비 1024px 권장).

---

## 2. 기술 스택 선정

### 2.1 Frontend — **Vite + React + TypeScript**

| 선택 이유 |
|-----------|
| Vite: 빠른 HMR, WebRTC 데모에 적합한 경량 번들 |
| React: 탭·로비·통화 UI 상태가 많아 컴포넌트 분리 용이 |
| TypeScript: 시그널링 메시지·Room 타입 안정성 |

**주요 라이브러리 (안)**

| 용도 | 패키지 |
|------|--------|
| 라우팅 | `react-router-dom` |
| UI | CSS Modules 또는 Tailwind (팀 취향에 따라 1택) |
| WebRTC 래퍼 | **네이티브 RTCPeerConnection** (1차) — 필요 시 `simple-peer` 검토 |
| 실시간 채팅 | WebSocket (`socket.io-client`) |
| 상태 | React Context + `useReducer` (통화·로비) |

### 2.2 Backend — **Node.js + Express + Socket.IO**

| 선택 이유 |
|-----------|
| WebSocket 시그널링과 HTTP API를 한 프로세스에서 처리 |
| Socket.IO: 방 join/leave, SDP/ICE relay, 채팅 브로드캐스트에 적합 |
| JS 풀스택으로 FE 타입·메시지 스키마 공유 가능 |

**주요 라이브러리 (안)**

| 용도 | 패키지 |
|------|--------|
| HTTP | `express` |
| WebSocket | `socket.io` |
| CORS | `cors` |
| 개발 | `tsx` / `nodemon` |
| (선택) TURN/STUN | `coturn` Docker 또는 공개 STUN만 1차 |

### 2.3 WebRTC 아키텍처 — **Mesh (1차)**

```
┌─────────┐     WebSocket (시그널링)      ┌─────────┐
│ Client A│◄────────────────────────────►│  Node   │
└────┬────┘                               │ Server  │
     │         SDP offer/answer           └────┬────┘
     │         ICE candidates                  │
     ▼ P2P media (audio/video)                 ▼
┌─────────┐◄────────────────────────────►┌─────────┐
│ Client B│         (Mesh: N*(N-1)/2)     │ Client C│
└─────────┘                               └─────────┘
```

| 방식 | 1차(MVP) | 2차(확장) |
|------|----------|-----------|
| 미디어 | **Mesh** — 참가자 ≤8명이면 구현 단순 | SFU (mediasoup / LiveKit) |
| STUN | Google 공개 `stun:stun.l.google.com:19302` | 자체 coturn |
| TURN | 없음(동일 NAT 환경·데모) | coturn + 자격증명 |

> 음성 위주 MVP도 **getUserMedia({ audio: true, video: optional })** 로 영상 토글 가능하게 설계.

---

## 3. 화면 구조 및 네비게이션

### 3.1 전역 레이아웃

```
┌──────────────────────────────────────────────────┐
│ AppBar  [Logo lnvoice]              [userId ▼]   │
├──────────────────────────────────────────────────┤
│                                                  │
│              Main Content (탭별)                  │
│                                                  │
├──────────────────────────────────────────────────┤
│ Footer  [ 로비 ]  [ 대화 ]  [ 설정 ]              │
└──────────────────────────────────────────────────┘
```

| 영역 | 설명 |
|------|------|
| **AppBar** | 좌: 로고(클릭 시 로비), 우: 로그인 ID 표시 + 로그아웃(선택) |
| **Main** | 하단 탭에 따라 로비 / 통화·채팅 / 설정 |
| **Footer** | 3탭 고정. 활성 탭 하이라이트 |

### 3.2 라우트·탭 매핑

| Footer 탭 | 경로 | 비고 |
|-----------|------|------|
| 로비 | `/lobby` | 미로그인 시 `/login` 리다이렉트 |
| 대화 | `/room/:roomId` | 방 입장 후만 활성(미입장 시 로비로) |
| 설정 | `/settings` | **빈 페이지** (placeholder) |

### 3.3 로그인 (`/login`)

- 단일 입력: **사용자 ID** (문자·숫자·`_`·`-`, 2~20자)
- 버튼: **입장**
- 비밀번호 필드 **없음**
- ID는 `sessionStorage`에 저장 (탭 닫으면 재로그인)
- 서버: ID 중복 허용(동일 ID 여러 탭 가능) — 2차에 unique 정책 검토

### 3.4 로비 (`/lobby`)

**방 목록 — 2열 × 4행 그리드 (한 화면에 최대 8칸)**

```
┌──────────┬──────────┐
│  Room 1  │  Room 2  │
├──────────┼──────────┤
│  Room 3  │  Room 4  │
├──────────┼──────────┤
│  Room 5  │  Room 6  │
├──────────┼──────────┤
│  Room 7  │  Room 8  │
└──────────┴──────────┘
     ↓ 방 > 8개 시 세로 스크롤
```

**방 카드(박스) 정보**

- 방 이름
- 현재 인원 / 최대 인원 (예: `3/8`)
- 상태 뱃지: `대기` | `통화중`
- 클릭 → 해당 방 입장 → Footer **대화** 탭으로 전환 + `/room/:roomId`

**추가 UI (MVP)**

- 상단: `방 만들기` (이름 입력 모달) — 선택 구현, 없으면 서버 시드 8개 고정 방

### 3.5 대화 (`/room/:roomId`)

**상단 서브탭 (통화 화면 내부)**

| 서브탭 | 내용 |
|--------|------|
| **통화** | 로컬/원격 비디오(또는 아바타) 그리드, Mute, 카메라 On/Off, 나가기 |
| **채팅** | 메시지 목록 + 입력창 + 전송 (WebSocket, 방 단위) |

**통화 UI (Mesh, ≤8명)**

- 참가자 타일: 2×2 ~ 3×3 adaptive grid
- 컨트롤 바: 🎤 Mute / 📷 Video / 📞 나가기(로비로)
- 입장 시 `getUserMedia` 권한 요청

**채팅**

- 시스템 메시지: `○○님이 입장했습니다`
- 일반 텍스트, 타임스탬프, 발신 ID

### 3.6 설정 (`/settings`)

- 제목만: **설정**
- 본문: `준비 중입니다.` (빈 페이지)
- 2차: 마이크/스피커 선택, 테마, 언어 등

---

## 4. 기능 요구사항 상세

### 4.1 인증·세션

| ID | 요구 | 우선순위 |
|----|------|----------|
| AUTH-01 | ID만 입력하여 로그인 | P0 |
| AUTH-02 | AppBar에 현재 ID 표시 | P0 |
| AUTH-03 | 미로그인 시 보호 라우트 → `/login` | P0 |

### 4.2 로비·방

| ID | 요구 | 우선순위 |
|----|------|----------|
| LOBBY-01 | 방 목록 2×4 그리드 | P0 |
| LOBBY-02 | 8개 초과 시 스크롤 | P0 |
| LOBBY-03 | 방 카드에 인원·상태 표시 | P0 |
| LOBBY-04 | 방 클릭 시 입장 | P0 |

### 4.3 WebRTC 통화

| ID | 요구 | 우선순위 |
|----|------|----------|
| RTC-01 | 방 입장 시 오디오 스트림 획득 | P0 |
| RTC-02 | 다자간 Mesh 연결 (≤8) | P0 |
| RTC-03 | Mute / Unmute | P0 |
| RTC-04 | Video On/Off (선택, P1) | P1 |
| RTC-05 | 퇴장 시 PeerConnection 정리 | P0 |
| RTC-06 | ICE 실패 시 사용자 알림 | P1 |

### 4.4 채팅

| ID | 요구 | 우선순위 |
|----|------|----------|
| CHAT-01 | 방 단위 실시간 메시지 | P0 |
| CHAT-02 | 입장/퇴장 시스템 메시지 | P1 |

### 4.5 설정

| ID | 요구 | 우선순위 |
|----|------|----------|
| SET-01 | 빈 placeholder 페이지 | P0 |

---

## 5. 시그널링·API 설계

### 5.1 REST (Express)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/health` | 헬스체크 |
| GET | `/api/rooms` | 방 목록 + `participantCount` |
| POST | `/api/rooms` | 방 생성 `{ name, maxParticipants?: 8 }` |

### 5.2 Socket.IO 이벤트

**Client → Server**

| Event | Payload | 설명 |
|-------|---------|------|
| `join-room` | `{ roomId, userId }` | 방·시그널링 채널 join |
| `leave-room` | `{ roomId }` | 퇴장 |
| `signal` | `{ to, from, sdp?, candidate? }` | WebRTC 시그널 relay |
| `chat-message` | `{ roomId, userId, text, ts }` | 채팅 |

**Server → Client**

| Event | Payload | 설명 |
|-------|---------|------|
| `room-users` | `{ users: string[] }` | 현재 참가자 목록 |
| `user-joined` | `{ userId }` | 신규 참가 → Mesh offer 시작 트리거 |
| `user-left` | `{ userId }` | Peer 정리 |
| `signal` | (relay) | SDP/ICE 전달 |
| `chat-message` | (broadcast) | 채팅 수신 |
| `room-list-updated` | `{ rooms }` | 로비 실시간 갱신(선택) |

### 5.3 Mesh 연결 순서 (참고)

1. A가 `join-room` → 서버가 `room-users` 반환  
2. B 입장 → A,B에게 `user-joined`  
3. **정렬 규칙:** `userId` 사전순이 작은 쪽만 `createOffer` (글래어링 방지)  
4. `signal`로 offer/answer/ICE 교환  
5. `ontrack`으로 원격 스트림 UI에 바인딩  

---

## 6. 데이터 모델 (인메모리 MVP)

```ts
// Room (서버)
interface Room {
  id: string;
  name: string;
  maxParticipants: number; // default 8
  participants: Map<socketId, { userId: string }>;
}

// Client session
interface UserSession {
  userId: string;
  currentRoomId: string | null;
}
```

- DB **없음** (1차): 서버 재시작 시 방·채팅 이력 소멸 acceptable  
- 2차: Redis(방 상태) + PostgreSQL(방 메타) 검토  

---

## 7. 디렉터리 구조 (안)

```
lnvoice/
├── docs/
│   ├── req.md
│   └── req_final.md          # 본 문서
├── packages/                  # (선택) monorepo
│   └── shared/               # 공통 타입·이벤트 상수
├── apps/
│   ├── web/                  # Vite + React
│   │   ├── src/
│   │   │   ├── components/   # AppBar, Footer, RoomCard, VideoGrid
│   │   │   ├── pages/        # Login, Lobby, Room, Settings
│   │   │   ├── hooks/        # useWebRTC, useSocket
│   │   │   ├── context/      # AuthContext, RoomContext
│   │   │   └── lib/          # signaling helpers
│   │   └── vite.config.ts
│   └── server/               # Node + Express + Socket.IO
│       ├── src/
│       │   ├── index.ts
│       │   ├── rooms.ts      # 인메모리 방 관리
│       │   └── socket/       # join, signal, chat handlers
│       └── package.json
├── package.json              # npm workspaces root
└── README.md
```

**단순 monorepo 대안:** `client/` + `server/` 2폴더 (MVP에 권장)

---

## 8. UI/UX 가이드 (요약)

| 요소 | 스펙 |
|------|------|
| AppBar 높이 | 56px |
| Footer 높이 | 56px, 아이콘+라벨 |
| 로비 카드 | min-height 120px, border-radius 12px, hover shadow |
| 그리드 gap | 16px |
| 컬러 | Primary `#4F46E5`, 배경 `#F8FAFC`, 카드 `#FFFFFF` |
| 폰트 | system-ui, Pretendard(선택) |

---

## 9. Chrome·WebRTC 체크리스트

- [ ] `localhost` 또는 HTTPS에서 테스트  
- [ ] `navigator.mediaDevices.getUserMedia` 권한 UX  
- [ ] Autoplay 정책: 원격 video는 `muted` 속성 후 unmute 패턴 검토  
- [ ] `RTCPeerConnection` 종료 시 `close()` + track `stop()`  
- [ ] Opus 코덱 기본 사용 (Chrome 기본)  
- [ ] echo cancellation / noise suppression: `audio: { echoCancellation: true, noiseSuppression: true }`  

---

## 10. 구현 단계 (로드맵)

| Phase | 기간(안) | 산출물 |
|-------|----------|--------|
| **0** | 0.5d | 본 기획서 확정, repo 스캐폴딩 |
| **1** | 1d | Login + AppBar + Footer + 라우팅 + Settings 빈 페이지 |
| **2** | 1d | 로비 2×4 UI, REST 방 목록, RoomCard |
| **3** | 2d | Socket.IO join/leave, Mesh WebRTC, 통화 탭 |
| **4** | 0.5d | 채팅 탭, 시스템 메시지 |
| **5** | 0.5d | Chrome E2E 수동 테스트, README·실행 스크립트 |

**총 MVP:** 약 **5~6인일** (1인 기준)

---

## 11. 로컬 개발·실행 (안)

```bash
# 루트
npm install

# 터미널 1 — 서버 (예: :3001)
cd server && npm run dev

# 터미널 2 — 클라이언트 (예: :5173, proxy → 3001)
cd client && npm run dev
```

- Vite `server.proxy`로 `/api`, `/socket.io` 프록시  
- 통화 테스트: Chrome 시크릿 2창 + 서로 다른 ID  

---

## 12. 리스크·제한

| 리스크 | 완화 |
|--------|------|
| Mesh는 N>4에서 CPU·대역폭 급증 | MVP 8명 상한, 2차 SFU |
| TURN 없음 → 일부 NAT에서 연결 실패 | 데모는 동일 Wi‑Fi, 2차 coturn |
| ID 무인증 → 스푸핑 | 내부망·데모 한정, 2차 토큰 |
| 동일 ID 다중 접속 혼란 | UI에 socket 구분 표시(선택) |

---

## 13. 2차 백로그 (범위 외)

- SFU(mediasoup) 전환
- Push-to-talk, speaking indicator
- 방 비밀번호·초대 링크
- 녹음·STT(Whisper)
- PWA·모바일 레이아웃
- 설정: 장치 선택, 다크 모드

---

## 14. 승인·다음 단계

1. 본 `req_final.md` 검토·수정 요청  
2. 승인 후 **Phase 0~1** 스캐폴딩 (`client/` + `server/`) 구현 시작  
3. 구현 시 본 문서의 이벤트명·라우트를 **단일 소스**로 유지  

---

*작성: lnvoice 기획 · FE Vite+React · BE Node+Socket.IO · WebRTC Mesh*
