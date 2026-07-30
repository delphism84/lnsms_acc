# TODO — ESP32 세션 (CALL_PROTOCOL_V2 이어서)

> 서버(FE/BE)는 **완료·배포됨**. P4 펌웨어 P0/P1는 **로컬 구현·플래시 완료** (2026-07-28).
> 호스트 UFW: **9101–9104/tcp ALLOW** (2026-07-28). `/api/devices`에 `p4-eth` 4채널 HELO 확인됨.
> Vultr 클라우드 FW에 별도 규칙이 있으면 동일 포트도 열 것.

## 배포된 서버 (참고)

| 항목 | 값 |
|------|-----|
| UI / API | https://voice.dualmodule.com/ |
| 코드 (호스트) | `/var/lnsms/packages/esp32-voice` |
| 코드 (이 저장소) | `stream/voice-node/` |
| PM2 | `esp32-voice` → `127.0.0.1:53110` |
| nginx | `voice.dualmodule.com` → `:53110` |
| Video / Audio / PLAY / CTRL | **TCP 9101 / 9102 / 9103 / 9104** |
| UFW | `9101:9104/tcp ALLOW` (comment: esp32-voice CALL_PROTOCOL_V2 ingest) |
| 기존 necall ingest | `:9001/:9002` (**건드리지 말 것**) |
| srmes / MES | **절대 설정·재시작 금지** (HARD LOCK) |

프로토콜: [`stream/docs/CALL_PROTOCOL_V2.md`](stream/docs/CALL_PROTOCOL_V2.md)

펌웨어 트리: `C:\ln\esp32\projects\p4_stream` (호스트 로컬)

### 호스트 스모크 (완료)

```bash
sudo ufw status | grep 910
ss -lntp | grep 910
curl -s https://voice.dualmodule.com/api/devices
# → p4-eth: video/audio/play/ctrl 전부 true 이면 TCP 경로 OK
```

---

## P0 — 펌웨어 필수

- [x] **CTRL `:9104`** — `CTRL`/`ACKN`/`PING`/`PONG`, `set_gain`/`mute`/`join`/`leave`/`call`/`request_idr`
- [x] **PLAY `:9103`** — PCM → ES8311 duplex out (gain 100 기본, PA on)
- [x] **HELO v2 (framed 20+96 B)** — caps / room_hint / mic&spk pct
- [x] **AFRM `:9102`** — mute 시 송신 중단 + gain 적용
- [x] **VFRM `:9101`** — voice 포트로 전환 (necall 9001과 분리)
- [x] 부팅 프로파일 mic=100, spk=100, AGC off
- [x] **인프라**: 호스트 UFW **9101–9104/tcp 공개** (`p4-eth` 접속 확인)

## P1 — 통화 상태 · 안정화

- [x] `call_state` idle/ringing/active/hold (CTRL)
- [x] PLAY timeout → silence + underrun 카운터 (`state`)
- [x] `request_idr` → FORCE_KEY_FRAME
- [x] CTRL `ping`/`pong` (+ periodic `state`)

## P2 — 서버·룸 연동 검증

- [x] P4 → `voice.dualmodule.com` **9101–9104** 접속 (`p4-eth` HELO 4채널)
- [ ] UI에서 `/api/devices/:id/gain|mute|join` → 기기 반영 확인
- [ ] 2대 이상 exclude-self **믹스 PLAY** (서버 `mix.Audio` 고도화 — 현재는 루프백 bring-up)
- [ ] `room_hint` HELO → 자동 방 바인딩
- [ ] UI gain/mute · PLAY 루프백 청취 검증

## P3 — 미결

- [ ] AUTH 토큰
- [ ] 믹스 / max N
- [ ] viewer talkback
- [ ] TLS vs LAN only

---

## 세션 체크리스트

1. `git pull` on `delphism84/esp32-stream`
2. 프로토콜: `stream/docs/CALL_PROTOCOL_V2.md`
3. `curl -s https://voice.dualmodule.com/api/health` + `/api/devices`
4. **srmes / MES 금지**
5. necall `:9001/:9002`와 포트 섞지 말 것

## 완료 정의

1. 단일 P4가 9102/9103/9104로 붙어 UI gain/mute — **TCP OK, UI 검증 남음**
2. PLAY 루프백 스피커 — **펌웨어 준비됨, 청취 검증 남음**
3. 2디바이스 믹스 — 서버 P2

## PLAY audio (서버 준비됨 — 펌웨어 pull 후 이어가기)

ESP32-P4 PLAY `:9103` 사양에 맞춘 TTS 에셋:

- `stream/voice-node/assets/play/tts_voice_test.pcm` — s16le / 16 kHz / mono / **640 B 정렬**
- `stream/voice-node/assets/play/README.md` — 와이어 포맷
- 빌드: `stream/voice-node/scripts/build-play-tts.sh` (Edge neural + loudnorm/compress/limiter)
- 서버 룸 믹스: `stream/voice-node/server/mix.js` → exclude-self → `writePlay`

검증: `curl -s https://voice.dualmodule.com/api/rooms/esp1/play-loop`

