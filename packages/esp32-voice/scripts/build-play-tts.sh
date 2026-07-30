#!/usr/bin/env bash
# Build ESP32-P4 PLAY audio (CALL_PROTOCOL_V2 :9103)
# Target: PCM s16le / 16 kHz / mono / 20 ms = 640 B frames
# Voice level: loudnorm ~-16 LUFS + light compression + limiter (human speech)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/tmp}"
ASSETS="${ASSETS:-$ROOT/assets/play}"
TEXT="${TEXT:-소리 테스트 중입니다}"
VOICE="${VOICE:-ko-KR-SunHiNeural}"
RATE="${RATE:--5%}"

mkdir -p "$OUT_DIR" "$ASSETS"

echo "[1/4] neural TTS → mp3 ($VOICE): $TEXT"
python3 - "$OUT_DIR/tts_raw.mp3" "$TEXT" "$VOICE" "$RATE" <<'PY'
import asyncio, sys, edge_tts
out, text, voice, rate = sys.argv[1:5]
async def main():
    await edge_tts.Communicate(text, voice, rate=rate).save(out)
asyncio.run(main())
PY

echo "[2/4] loudnorm + compressor + limiter → 16 kHz mono wav"
ffmpeg -y -hide_banner -loglevel error \
  -i "$OUT_DIR/tts_raw.mp3" \
  -af "loudnorm=I=-14:TP=-1.0:LRA=8,\
acompressor=threshold=-18dB:ratio=3:attack=10:release=100:makeup=4,\
dynaudnorm=f=100:g=12:p=0.9,\
alimiter=limit=0.92:attack=5:release=40,\
apad=pad_dur=0.45" \
  -ac 1 -ar 16000 -c:a pcm_s16le \
  "$OUT_DIR/tts_16k.wav"

echo "[3/4] raw PCM s16le + pad to 640 B frames"
ffmpeg -y -hide_banner -loglevel error \
  -i "$OUT_DIR/tts_16k.wav" \
  -f s16le -acodec pcm_s16le \
  "$OUT_DIR/tts_16k.pcm"

python3 - "$OUT_DIR" <<'PY'
import pathlib, struct, math, sys, subprocess
out = pathlib.Path(sys.argv[1])
data = bytearray((out / "tts_16k.pcm").read_bytes())
rem = len(data) % 640
if rem:
    data.extend(b"\x00" * (640 - rem))
(out / "tts_16k.pcm").write_bytes(data)
(out / "servertest1.pcm").write_bytes(data)
subprocess.check_call([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-f", "s16le", "-ar", "16000", "-ac", "1", "-i", str(out / "tts_16k.pcm"),
    "-codec:a", "libmp3lame", "-qscale:a", "3",
    str(out / "servertest1.mp3"),
])
n = len(data) // 2
samples = struct.unpack("<" + "h" * n, bytes(data))
peak = max(abs(s) for s in samples) or 1
rms = math.sqrt(sum(s * s for s in samples) / n)
print(f"PCM bytes={len(data)} frames={len(data)//640} dur={n/16000:.2f}s")
print(f"peak={peak} ({100*peak/32767:.1f}%)  rms={rms:.0f} ({100*rms/32767:.1f}%)")
assert len(data) % 640 == 0, "PLAY frame alignment failed"
PY

echo "[4/4] copy assets"
cp -f "$OUT_DIR/servertest1.pcm" "$ASSETS/tts_voice_test.pcm"
cp -f "$OUT_DIR/servertest1.mp3" "$ASSETS/tts_voice_test.mp3"
cp -f "$OUT_DIR/servertest1.mp3" "$ROOT/public/servertest1.mp3"

cat > "$ASSETS/README.md" <<'EOF'
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

## Rebuild

```bash
cd stream/voice-node
./scripts/build-play-tts.sh
TEXT='다른 문장' VOICE=ko-KR-InJoonNeural ./scripts/build-play-tts.sh
```

Processing: Edge neural TTS → **loudnorm ≈ -16 LUFS** → light compressor → limiter (0.89) → 16 kHz mono s16le → pad to N×640.
EOF

echo "OK"
ls -la "$ASSETS" "$OUT_DIR/servertest1.pcm" "$OUT_DIR/servertest1.mp3"
