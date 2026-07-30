# PLAY audio assets (ESP32-P4)

## Wire format (`stream_config.h` / CALL_PROTOCOL_V2 PLAY `:9103`)

| Item | Value |
|------|-------|
| Format | PCM **s16le** |
| Sample rate | **16000** Hz |
| Channels | **1** (mono) |
| Frame | **20 ms = 640 bytes** |
| Bitrate | 256 kbps uncompressed |
| Codec | none (raw) → ES8311 / I2S |

## Files

- `tts_voice_test.pcm` — raw PLAY payload (**640-byte aligned**)
- `tts_voice_test.mp3` — same clip for browser room preview

Phrase: **소리 테스트 중입니다** (Edge `ko-KR-SunHiNeural`)

## Rebuild

```bash
cd stream/voice-node
./scripts/build-play-tts.sh
TEXT='다른 문장' VOICE=ko-KR-InJoonNeural ./scripts/build-play-tts.sh
```

Processing: Edge neural TTS → **loudnorm ≈ -14 LUFS** → compressor → dynaudnorm → limiter (0.92) → 16 kHz mono s16le → pad to N×640.

Measured (current build): peak ≈ **97% FS**, RMS ≈ **18%** — speech-like for ES8311 small speaker.

## Server path

`RoomMixer` (`server/mix.js`) mixes TTS + room sources → `ingest.writePlay()` → TCP PLAY frames every 20 ms.
If host `Send-Q` on `:9103` sticks near ~96–100 KB, firmware is not draining PLAY (check I2S/ES8311 reader).
