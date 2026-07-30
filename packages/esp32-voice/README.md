# esp32-voice

CALL_PROTOCOL_V2 기반 **다자간 음성 통화** 서버 + 경량 HTML UI.

## 구성

| 경로 | 역할 |
|------|------|
| `server/` | Node Express + WS 시그널링 + ESP32 TCP ingest stub |
| `public/` | 아주 가벼운 HTML/CSS/JS (마이크·스피커 장치/볼륨/뮤트) |
| `CALL_PROTOCOL_V2.md` | 프로토콜 원문 |

## 포트 (기존 서비스와 분리)

| 용도 | 포트 | 비고 |
|------|------|------|
| HTTP + WSS | **53110** (127.0.0.1) | nginx → voice.dualmodule.com |
| Video up | **9101** | 기존 necall 9001과 분리 |
| Audio up | **9102** | |
| PLAY down | **9103** | |
| CTRL | **9104** | |

## 실행

```bash
cd /var/lnsms/packages/esp32-voice
npm install
pm2 start ecosystem.config.cjs
```

공개 URL: https://voice.dualmodule.com/

## API (요약)

- `GET /api/rooms` `POST /api/rooms`
- `GET /api/devices`
- `POST /api/devices/:id/gain` `{mic,spk}`
- `POST /api/devices/:id/mute` `{mic,spk}`
- `WS /ws` — WebRTC mesh 시그널 + 방 이벤트
