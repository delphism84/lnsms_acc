# Call / multi-party protocol v2 (server-first)

Target product:
- ESP32-P4 endpoint: camera + **max mic/speaker gain**
- Server: room, multi-party mix/route, WebRTC
- Operator UI: **mouse-driven** (volume, mute, join/leave, speaker select)

P4 does **not** know participant lists. It only speaks media + control.
Multi-party and mouse UX live on the server.

Related:
- Current device ingest (v1): [`../esp32/docs/INGEST_PROTOCOL.md`](../esp32/docs/INGEST_PROTOCOL.md)
- Current WebRTC server notes: [`SERVER_WEBRTC_INGEST.md`](SERVER_WEBRTC_INGEST.md)

Implementation order: **server (this doc) → firmware**.

---

## 1. Roles

| Actor | Responsibility |
|-------|------------------|
| **ESP32-P4** | H.264 up, mic PCM up, **speaker PCM down**, apply gain/mute, report call state |
| **Ingest / call server** | Rooms, ACL, A/V route & mix, WebRTC fan-out, CTRL fan-in from UI |
| **PC/mobile UI** | Mouse: join room, pick speakers, sliders, mute — via server HTTP/WS only |

```
P4 cam/mic  --TCP 9001/9002-->  ingest  --mix/route-->  WebRTC viewers + other endpoints
P4 speaker  <--TCP 9003 PLAY--  ingest
UI (mouse)  <--HTTPS/WSS------>  signaling / room API
```

---

## 2. Channels (v2)

| Channel | Port | Direction | Magic | Notes |
|---------|------|-----------|-------|-------|
| Video up | **9001** | P4→server | `VFRM` | Same as v1 |
| Audio up | **9002** | P4→server | `AFRM` | Same as v1 |
| Audio down | **9003** | server→P4 | `PLAY` | **New** — one mix per device |
| Control | **9004** | bidirectional | `CTRL` / `ACKN` | **New** — gain, mute, call, IDR |

Keep control off the media sockets so audio realtime is not blocked by JSON.

Env (server): `INGEST_VIDEO_PORT`, `INGEST_AUDIO_PORT`, `INGEST_PLAY_PORT`, `INGEST_CTRL_PORT`.

---

## 3. Framing

Unchanged 20-byte header (big-endian):

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | `magic` |
| 4 | 8 | `pts_us` |
| 12 | 4 | `flags` |
| 16 | 4 | `len` |
| 20 | `len` | payload |

| magic | Use |
|-------|-----|
| `HELO` | First message on each socket |
| `VFRM` | H.264 Annex-B AU |
| `AFRM` | Mic PCM s16le |
| `PLAY` | Speaker PCM s16le |
| `CTRL` | Control request/event (JSON UTF-8) |
| `ACKN` | Control reply |
| `PING` / `PONG` | Keepalive on control |

`proto_ver = 2` in HELO. v1 clients (`proto_ver=1`, no PLAY/CTRL) remain monitor-only.

### 3.1 HELO v2 (96 bytes)

Bytes 0–71: same layout as v1 ([INGEST_PROTOCOL.md](../esp32/docs/INGEST_PROTOCOL.md)).

| Offset | Size | Field |
|--------|------|-------|
| 72 | 4 | `caps` bitmask |
| 76 | 16 | `room_hint` UTF-8 NUL-padded (optional) |
| 92 | 2 | `mic_gain_pct` 0–100 (boot default; **100 = device max**) |
| 94 | 2 | `spk_gain_pct` 0–100 |

`caps` bits:
- 0 video up, 1 mic up, 2 spk down, 3 ctrl, 4 hw AEC, 5 NS, 6 AGC off (manual max)

Default voice profile on P4: mic=100, spk=100, AGC off.

---

## 4. Media rules

### 4.1 Mic up (`AFRM`)

- PCM s16le, 16 kHz mono, 20 ms (640 B) preferred
- Local mute: **stop sending** (or send silence); set CTRL state `mic_muted`

### 4.2 Speaker down (`PLAY`)

- Same PCM format as up
- **One downmix stream per P4** — server mixes N−1 (or selected) participants
- UI “listen to A only” changes **server routing only**; PLAY framing unchanged
- `flags` bit0 = flush/end; bit1 reserved

P4 play-out jitter target: 40–80 ms (call). Underrun → insert silence, report in `state`.

### 4.3 Video (`VFRM`)

- Monitor / presence; not required for audio-only call legs
- `request_idr` on CTRL when a mouse user opens the tile

### 4.4 Sync

- Shared `t0_us` / `pts_us` timeline across V/A (existing)
- PLAY `pts_us` = server mix timeline; P4 does not A/V lip-sync to remote video for v2 MVP

---

## 5. Control (`CTRL` / `ACKN`)

Payload: JSON object, UTF-8. One object per frame.

### 5.1 Server → P4

| `cmd` | Fields | Effect |
|-------|--------|--------|
| `auth` | `token` | Optional; required if server enforces |
| `set_gain` | `mic`, `spk` (0–100) | HW gain; 100 = max |
| `mute` | `mic`, `spk` (bool) | Local mute |
| `join` | `room_id`, `role` (`endpoint`\|`monitor`) | Enter call |
| `leave` | — | Idle; flush PLAY |
| `call` | `state` (`idle`\|`ringing`\|`active`\|`hold`) | UI/LED hooks |
| `request_idr` | — | Next video keyframe |
| `ping` | `t` | RTT |

### 5.2 P4 → server

| `cmd` | Fields |
|-------|--------|
| `hello_caps` | applied gains, caps, versions |
| `gain_ack` | `mic`, `spk` |
| `state` | `call_state`, mutes, underrun counters, peak |
| `error` | `code`, `msg` |
| `pong` | `t` |

Mouse UI mapping:
- Volume slider → `set_gain`
- Speaker/mic icons → `mute`
- Room tile / join button → room API on server → `join`/`leave` to P4
- Participant “solo listen” → server mixer only
- Refresh video → `request_idr`

---

## 6. Server design (do this first)

### 6.1 Components

```
cmd/ingest-webrtc (evolve) or cmd/call-server
  ├─ ingest.Video :9001
  ├─ ingest.Audio :9002
  ├─ play.Out     :9003   // per-device writer
  ├─ ctrl.Link    :9004   // per-device JSON
  ├─ room.Hub           // rooms, members, roles
  ├─ mix.Audio          // PCM mix → PLAY
  ├─ broadcast.Hub      // existing WebRTC path
  └─ api.HTTP/WS        // mouse UI: rooms, gains, mute, ICE
```

### 6.2 Room model

```text
Room {
  id
  members[] { device_id | viewer_id, role, muted_in, muted_out }
}
```

- `endpoint`: has TCP media (+ optional WebRTC mirror)
- `viewer`: WebRTC only (mouse operator)

Audio path for endpoint E in room R:
1. Collect `AFRM` from all endpoints in R except E (and apply mute flags)
2. Mix to mono 16 kHz
3. Write `PLAY` on E’s :9003 socket

Video: existing passthrough / WebRTC; optional select-by-device for UI grid.

### 6.3 HTTP/WS API sketch (UI)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/rooms` | List |
| POST | `/api/rooms` | Create |
| POST | `/api/rooms/{id}/join` | Viewer or bind device |
| POST | `/api/devices/{id}/gain` | `{mic,spk}` → CTRL |
| POST | `/api/devices/{id}/mute` | → CTRL |
| POST | `/api/devices/{id}/idr` | → CTRL |
| WS | `/ws/signal` | Existing WebRTC + room events |

### 6.4 Max-volume policy (server)

- On device HELO: if gains omitted, treat as 100/100
- Reject UI values outside 0–100
- Do not apply server-side AGC on PLAY for v2 MVP (preserve loudness)

### 6.5 Suggested server milestones

1. **CTRL listener :9004** — parse JSON, log, `set_gain`/`mute` no-op stub → ACKN  
2. **PLAY writer :9003** — loopback mic→PLAY (1 device) for speaker bring-up  
3. **Room + mix** — 2+ devices, exclude-self mix  
4. **UI hooks** — gain/mute/join over HTTPS  
5. **Wire firmware** — P4 `audio_rx` + `ctrl_link`

---

## 7. P4 firmware map (later)

```
video_tx   :9001
audio_tx   :9002  + mute/gain
audio_rx   :9003  PLAY → ES8311 out (max default)
ctrl_link  :9004  CTRL/ACKN
```

Not in v2 MVP: P4-side participant list, P2P between devices, device-side mouse.

---

## 8. Compatibility

| Client | Behavior |
|--------|----------|
| v1 HELO only | Video+mic ingest, WebRTC monitor (today) |
| v2 + PLAY + CTRL | Full call endpoint |
| v2 HELO, no PLAY yet | Server skips mix for that device |

---

## 9. Open decisions (resolve during server impl)

1. AUTH token format (static device secret vs short-lived JWT)
2. Mix algorithm (clip-sum vs soft-limit) and max N in one room
3. Whether viewers can inject mic into the room mix (operator talkback)
4. TLS for :9001–9004 vs private PoE LAN only
