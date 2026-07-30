/**
 * Room audio mixer — CALL_PROTOCOL_V2 §6
 * Sources: ESP AFRM + browser WS uplink + optional TTS
 * Output: exclude-self mix → each device PLAY (:9103), 20 ms / 640 B s16le @ 16 kHz
 */
const FRAME = 640; // 320 samples * 2 bytes
const SAMPLES = 320;
const STALE_MS = 80;

function silence() {
  return Buffer.alloc(FRAME);
}

function padOrTrim(pcm) {
  if (!pcm || pcm.length === 0) return silence();
  if (pcm.length === FRAME) return pcm;
  if (pcm.length > FRAME) return pcm.subarray(0, FRAME);
  const out = Buffer.alloc(FRAME);
  pcm.copy(out);
  return out;
}

function applyGainBuf(pcm, gain) {
  const g = Number(gain);
  if (!Number.isFinite(g) || g === 1) return pcm;
  if (g <= 0) return silence();
  const out = Buffer.allocUnsafe(FRAME);
  for (let i = 0; i + 1 < FRAME; i += 2) {
    let s = pcm.readInt16LE(i);
    s = Math.max(-32768, Math.min(32767, Math.round(s * g)));
    out.writeInt16LE(s, i);
  }
  return out;
}

function mixPcms(parts) {
  if (!parts.length) return silence();
  if (parts.length === 1) return parts[0];
  const out = Buffer.allocUnsafe(FRAME);
  for (let i = 0; i < SAMPLES; i++) {
    let sum = 0;
    for (const p of parts) sum += p.readInt16LE(i * 2);
    // soft clip
    if (sum > 32767) sum = 32767;
    if (sum < -32768) sum = -32768;
    out.writeInt16LE(sum, i * 2);
  }
  return out;
}

export class RoomMixer {
  /**
   * @param {import('./ingest.js').IngestServer} ingest
   */
  constructor(ingest) {
    this.ingest = ingest;
    /** @type {Map<string, { roomId: string, pcm: Buffer, gain: number, muted: boolean, ts: number }>} */
    this.viewers = new Map();
    /** @type {Map<string, { pcm: Buffer, offset: number, gainPct: number, label: string, audioUrl: string, startedAt: number }>} */
    this.tts = new Map();
    this.pts = Date.now() * 1000;
    this._ticks = 0;
    this._timer = setInterval(() => this.tick(), 20);
    console.log("[mix] room mixer started (20ms)");
  }

  setViewerPcm(viewerId, roomId, pcm, { gain = 100, muted = false } = {}) {
    if (!viewerId || !roomId) return;
    this.viewers.set(viewerId, {
      roomId,
      pcm: padOrTrim(pcm),
      gain: Math.max(0, Math.min(100, Number(gain) || 0)),
      muted: !!muted,
      ts: Date.now(),
    });
  }

  setViewerState(viewerId, patch = {}) {
    const v = this.viewers.get(viewerId);
    if (!v) return;
    if (typeof patch.gain === "number") v.gain = Math.max(0, Math.min(100, patch.gain));
    if (typeof patch.muted === "boolean") v.muted = patch.muted;
    if (typeof patch.roomId === "string") v.roomId = patch.roomId;
  }

  clearViewer(viewerId) {
    this.viewers.delete(viewerId);
  }

  startTts(roomId, pcm, { gainPct = 80, label = "tts", audioUrl = "/servertest1.mp3" } = {}) {
    if (!roomId || !pcm?.length) throw new Error("tts pcm required");
    this.tts.set(roomId, {
      pcm: Buffer.from(pcm),
      offset: 0,
      gainPct: Math.max(0, Math.min(100, Number(gainPct) || 0)),
      label,
      audioUrl,
      startedAt: Date.now(),
    });
  }

  stopTts(roomId) {
    return this.tts.delete(roomId);
  }

  ttsStatus(roomId) {
    const t = this.tts.get(roomId);
    if (!t) return null;
    return {
      roomId,
      label: t.label,
      gainPct: t.gainPct,
      audioUrl: t.audioUrl,
      startedAt: t.startedAt,
      running: true,
    };
  }

  nextTtsChunk(t) {
    const chunk = Buffer.alloc(FRAME);
    let filled = 0;
    const src = t.pcm;
    while (filled < FRAME) {
      const take = Math.min(FRAME - filled, src.length - t.offset);
      src.copy(chunk, filled, t.offset, t.offset + take);
      filled += take;
      t.offset += take;
      if (t.offset >= src.length) t.offset = 0;
    }
    return applyGainBuf(chunk, t.gainPct / 100);
  }

  collectSources(roomId) {
    const now = Date.now();
    const sources = [];

    for (const sess of this.ingest.devices.values()) {
      if (sess.roomId !== roomId) continue;
      if (sess.micMuted) continue;
      if (!sess.lastPcm) continue;
      if (sess.lastPcmAt && now - sess.lastPcmAt > STALE_MS) continue;
      sources.push({
        id: sess.deviceId,
        kind: "device",
        pcm: applyGainBuf(padOrTrim(sess.lastPcm), (sess.micGain ?? 100) / 100),
      });
    }

    for (const [id, v] of this.viewers) {
      if (v.roomId !== roomId || v.muted) continue;
      if (now - v.ts > STALE_MS) continue;
      sources.push({
        id,
        kind: "viewer",
        pcm: applyGainBuf(padOrTrim(v.pcm), v.gain / 100),
      });
    }

    const tts = this.tts.get(roomId);
    if (tts) {
      sources.push({
        id: `tts:${tts.label}`,
        kind: "tts",
        pcm: this.nextTtsChunk(tts),
      });
    }

    return sources;
  }

  tick() {
    this._ticks++;
    const roomIds = new Set();
    for (const sess of this.ingest.devices.values()) {
      if (sess.roomId) roomIds.add(sess.roomId);
    }
    for (const v of this.viewers.values()) {
      if (v.roomId) roomIds.add(v.roomId);
    }
    for (const id of this.tts.keys()) roomIds.add(id);

    let sent = 0;
    for (const roomId of roomIds) {
      sent += this.mixRoom(roomId);
    }
    this.pts += 20000;
    if (this._ticks === 1 || this._ticks % 250 === 0) {
      console.log(
        `[mix] tick=${this._ticks} rooms=${roomIds.size} viewers=${this.viewers.size} tts=${this.tts.size} playFrames=${sent}`,
      );
    }
  }

  mixRoom(roomId) {
    const sources = this.collectSources(roomId);
    if (!sources.length) return 0;

    let n = 0;
    for (const sess of this.ingest.devices.values()) {
      if (sess.roomId !== roomId) continue;
      if (!sess.play || sess.spkMuted) continue;
      if (typeof sess.play.writableLength === "number" && sess.play.writableLength > FRAME * 50) {
        continue;
      }
      const parts = sources.filter((s) => s.id !== sess.deviceId).map((s) => s.pcm);
      // ESP should hear others + TTS even if alone with TTS
      if (!parts.length) continue;
      let mixed = mixPcms(parts);
      mixed = applyGainBuf(mixed, (sess.spkGain ?? 100) / 100);
      if (this.ingest.writePlay(sess.deviceId, mixed, this.pts)) n++;
    }
    return n;
  }
}

export { FRAME as MIX_FRAME };
