/**
 * CALL_PROTOCOL_V2 TCP channels (ports default 9101–9104 to avoid conflict with
 * existing esp32-ingest-webrtc on 9001/9002).
 *
 * MVP: accept HELO / AFRM / CTRL, log, ACKN for gain/mute/join.
 * PLAY: loopback last mic PCM to same device (bring-up); room mix later.
 */
import net from "node:net";
import { EventEmitter } from "node:events";

const MAGIC = {
  HELO: Buffer.from("HELO"),
  VFRM: Buffer.from("VFRM"),
  AFRM: Buffer.from("AFRM"),
  PLAY: Buffer.from("PLAY"),
  CTRL: Buffer.from("CTRL"),
  ACKN: Buffer.from("ACKN"),
  PING: Buffer.from("PING"),
  PONG: Buffer.from("PONG"),
};

function magicStr(buf) {
  return buf.toString("ascii");
}

function writePts(hdr, ptsUs) {
  const n = BigInt(ptsUs);
  hdr.writeUInt32BE(Number((n >> 32n) & 0xffffffffn), 4);
  hdr.writeUInt32BE(Number(n & 0xffffffffn), 8);
}

function sendFrame(socket, magic4, ptsUs, flags, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || "");
  const hdr = Buffer.alloc(20);
  Buffer.from(magic4).copy(hdr, 0, 0, 4);
  writePts(hdr, ptsUs);
  hdr.writeUInt32BE(flags >>> 0, 12);
  hdr.writeUInt32BE(body.length >>> 0, 16);
  if (socket && !socket.destroyed) socket.write(Buffer.concat([hdr, body]));
}

function calcAudioLevelPct(pcm) {
  if (!pcm?.length) return 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    const s = pcm.readInt16LE(i) / 32768;
    sumSq += s * s;
    n++;
  }
  if (!n) return 0;
  const rms = Math.sqrt(sumSq / n);
  return Math.max(0, Math.min(100, Math.round(rms * 220)));
}

class DeviceSession extends EventEmitter {
  constructor(deviceId) {
    super();
    this.deviceId = deviceId;
    this.video = null;
    this.audio = null;
    this.play = null;
    this.ctrl = null;
    this.roomId = null;
    this.micGain = 100;
    this.spkGain = 100;
    this.micMuted = false;
    this.spkMuted = false;
    this.callState = "idle";
    this.lastPcm = null;
    this.lastPcmAt = 0;
    this.audioLevel = 0;
    this.audioActive = false;
    this.hello = null;
  }
}

export class IngestServer extends EventEmitter {
  constructor(ports, roomHub) {
    super();
    this.ports = ports;
    this.rooms = roomHub;
    /** @type {Map<string, DeviceSession>} */
    this.devices = new Map();
    this.servers = [];
    this.stats = { videoConn: 0, audioConn: 0, playConn: 0, ctrlConn: 0 };
    /** @type {import('./mix.js').RoomMixer | null} */
    this.mixer = null;
  }

  setMixer(mixer) {
    this.mixer = mixer;
  }

  start() {
    this.servers.push(this.listen(this.ports.video, "video"));
    this.servers.push(this.listen(this.ports.audio, "audio"));
    this.servers.push(this.listen(this.ports.play, "play"));
    this.servers.push(this.listen(this.ports.ctrl, "ctrl"));
    console.log(
      `[ingest] video:${this.ports.video} audio:${this.ports.audio} play:${this.ports.play} ctrl:${this.ports.ctrl}`,
    );
  }

  listen(port, kind) {
    const srv = net.createServer((sock) => this.onConn(sock, kind));
    srv.on("error", (e) => console.error(`[ingest ${kind}]`, e.message));
    srv.listen(port, "0.0.0.0");
    return srv;
  }

  getOrCreate(deviceId) {
    let s = this.devices.get(deviceId);
    if (!s) {
      s = new DeviceSession(deviceId);
      this.devices.set(deviceId, s);
    }
    return s;
  }

  onConn(sock, kind) {
    sock.setNoDelay(true);
    let buf = Buffer.alloc(0);
    let deviceId = null;
    let session = null;

    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 20) {
        const len = buf.readUInt32BE(16);
        if (buf.length < 20 + len) break;
        const frame = buf.subarray(0, 20 + len);
        buf = buf.subarray(20 + len);
        this.handleFrame(sock, kind, frame, {
          get deviceId() {
            return deviceId;
          },
          setDevice: (id, sess) => {
            deviceId = id;
            session = sess;
          },
          get session() {
            return session;
          },
        });
      }
    };

    sock.on("data", onData);
    sock.on("close", () => {
      if (session) {
        /* Only clear if this sock is still the active channel — otherwise a
         * late close from a replaced connection wipes the new PLAY/CTRL/etc. */
        if (kind === "video" && session.video === sock) session.video = null;
        if (kind === "audio" && session.audio === sock) session.audio = null;
        if (kind === "play" && session.play === sock) session.play = null;
        if (kind === "ctrl" && session.ctrl === sock) session.ctrl = null;
        this.emit("device", session);
      }
    });
    sock.on("error", () => sock.destroy());
  }

  handleFrame(sock, kind, frame, ctx) {
    const magic = magicStr(frame.subarray(0, 4));
    const pts = (BigInt(frame.readUInt32BE(4)) << 32n) | BigInt(frame.readUInt32BE(8));
    const flags = frame.readUInt32BE(12);
    const payload = frame.subarray(20);

    if (magic === "HELO") {
      const deviceId = payload.subarray(0, 32).toString("utf8").replace(/\0/g, "").trim() || `dev-${Date.now()}`;
      const sess = this.getOrCreate(deviceId);
      sess.hello = { kind, pts: Number(pts), flags, rawLen: payload.length };
      if (payload.length >= 96) {
        sess.micGain = payload.readUInt16BE(92);
        sess.spkGain = payload.readUInt16BE(94);
        const roomHint = payload.subarray(76, 92).toString("utf8").replace(/\0/g, "").trim();
        if (roomHint) {
          if (sess.roomId && sess.roomId !== roomHint) {
            this.rooms.get(sess.roomId)?.removeDevice(deviceId);
          }
          sess.roomId = roomHint;
          const room = this.rooms.ensure(roomHint);
          room.addDevice({
            id: deviceId,
            name: deviceId,
            mutedIn: sess.micMuted,
            mutedOut: sess.spkMuted,
            micGain: sess.micGain,
            spkGain: sess.spkGain,
            online: true,
            audioLevel: sess.audioLevel || 0,
            audioActive: !!sess.audioActive,
          });
        }
      }
      const replace = (prev) => {
        if (prev && prev !== sock && !prev.destroyed) {
          try {
            prev.destroy();
          } catch {
            /* ignore */
          }
        }
        return sock;
      };
      if (kind === "video") {
        sess.video = replace(sess.video);
        this.stats.videoConn++;
      }
      if (kind === "audio") {
        sess.audio = replace(sess.audio);
        this.stats.audioConn++;
      }
      if (kind === "play") {
        sess.play = replace(sess.play);
        this.stats.playConn++;
      }
      if (kind === "ctrl") {
        sess.ctrl = replace(sess.ctrl);
        this.stats.ctrlConn++;
        // ACK hello
        this.sendCtrlAck(sock, { cmd: "hello_ok", device_id: deviceId, proto_ver: 2 });
      }
      ctx.setDevice(deviceId, sess);
      this.emit("device", sess);
      console.log(`[ingest] HELO ${kind} device=${deviceId}`);
      return;
    }

    const sess = ctx.session;
    if (!sess) return;

    if (magic === "AFRM" && kind === "audio") {
      if (!sess.micMuted) {
        sess.lastPcm = Buffer.from(payload);
        sess.lastPcmAt = Date.now();
        sess.audioLevel = calcAudioLevelPct(sess.lastPcm);
        sess.audioActive = sess.audioLevel > 2;
      } else {
        sess.lastPcm = null;
        sess.lastPcmAt = 0;
        sess.audioLevel = 0;
        sess.audioActive = false;
      }
      if (sess.roomId) {
        const room = this.rooms.get(sess.roomId);
        const device = room?.devices.get(sess.deviceId);
        if (device) {
          device.audioLevel = sess.audioLevel;
          device.audioActive = sess.audioActive;
        }
      }
      // Room mix → PLAY is handled by RoomMixer (exclude-self). No self-loopback.
      return;
    }

    if (magic === "CTRL" && kind === "ctrl") {
      let obj;
      try {
        obj = JSON.parse(payload.toString("utf8"));
      } catch {
        this.sendCtrlAck(sock, { cmd: "error", code: "bad_json" });
        return;
      }
      this.onCtrl(sess, obj, sock);
      return;
    }

    if (magic === "PING" && kind === "ctrl") {
      sendFrame(sock, "PONG", Number(pts), 0, payload);
    }
  }

  onCtrl(sess, obj, sock) {
    const cmd = obj.cmd;
    if (cmd === "join") {
      const roomId = String(obj.room_id || sess.roomId || "").trim();
      if (roomId) {
        if (sess.roomId && sess.roomId !== roomId) {
          this.rooms.get(sess.roomId)?.removeDevice(sess.deviceId);
        }
        sess.roomId = roomId;
        sess.callState = "active";
        this.rooms.ensure(roomId).addDevice({
          id: sess.deviceId,
          name: sess.deviceId,
          mutedIn: sess.micMuted,
          mutedOut: sess.spkMuted,
          micGain: sess.micGain,
          spkGain: sess.spkGain,
          online: true,
          audioLevel: sess.audioLevel || 0,
          audioActive: !!sess.audioActive,
        });
      }
      this.emit("ctrl", sess, obj);
      this.sendCtrlAck(sock, { cmd: "ack", of: cmd });
      return;
    }
    if (cmd === "hello_caps" || cmd === "state" || cmd === "gain_ack" || cmd === "error" || cmd === "pong") {
      this.emit("ctrl", sess, obj);
      this.sendCtrlAck(sock, { cmd: "ack", of: cmd });
      return;
    }
    // device shouldn't send server cmds, but tolerate
    this.sendCtrlAck(sock, { cmd: "ack", of: cmd });
  }

  /** Fan-out UI/WS chat to every device CTRL in the room. */
  forwardChatToRoom(roomId, chat) {
    const text = String(chat?.text || "").slice(0, 500);
    if (!roomId || !text) return 0;
    let n = 0;
    for (const sess of this.devices.values()) {
      if (sess.roomId !== roomId || !sess.ctrl) continue;
      const ok = this.sendToDevice(sess.deviceId, {
        cmd: "chat",
        from: chat.from || "",
        name: chat.name || "user",
        text,
        t: chat.t || Date.now(),
      });
      if (ok) n++;
    }
    return n;
  }

  /** Server → device CTRL (from UI API). */
  sendToDevice(deviceId, obj) {
    const sess = this.devices.get(deviceId);
    if (!sess?.ctrl) return false;
    if (obj.cmd === "set_gain") {
      if (typeof obj.mic === "number") sess.micGain = clamp(obj.mic, 0, 100);
      if (typeof obj.spk === "number") sess.spkGain = clamp(obj.spk, 0, 100);
    }
    if (obj.cmd === "mute") {
      if (typeof obj.mic === "boolean") sess.micMuted = obj.mic;
      if (typeof obj.spk === "boolean") sess.spkMuted = obj.spk;
    }
    if (obj.cmd === "join") sess.roomId = obj.room_id || sess.roomId;
    if (obj.cmd === "leave") {
      sess.callState = "idle";
    }
    if (obj.cmd === "call") sess.callState = obj.state || sess.callState;
    sendFrame(sess.ctrl, "CTRL", Date.now() * 1000, 0, JSON.stringify(obj));
    this.emit("device", sess);
    return true;
  }

  sendCtrlAck(sock, obj) {
    sendFrame(sock, "ACKN", Date.now() * 1000, 0, JSON.stringify(obj));
  }

  listDevices() {
    return [...this.devices.values()].map((d) => ({
      id: d.deviceId,
      roomId: d.roomId,
      micGain: d.micGain,
      spkGain: d.spkGain,
      micMuted: d.micMuted,
      spkMuted: d.spkMuted,
      callState: d.callState,
      video: !!d.video,
      audio: !!d.audio,
      play: !!d.play,
      ctrl: !!d.ctrl,
      audioLevel: d.audioLevel || 0,
      audioActive: !!d.audioActive,
    }));
  }

  /** Single 20 ms PLAY frame to a device (used by RoomMixer). */
  writePlay(deviceId, pcm, ptsUs) {
    const sess = this.devices.get(deviceId);
    if (!sess?.play || sess.spkMuted) return false;
    if (typeof sess.play.writableLength === "number" && sess.play.writableLength > 640 * 50) {
      return false;
    }
    const body = pcm?.length === 640 ? pcm : (() => {
      const b = Buffer.alloc(640);
      if (pcm?.length) pcm.copy(b, 0, 0, Math.min(640, pcm.length));
      return b;
    })();
    sendFrame(sess.play, "PLAY", ptsUs ?? Date.now() * 1000, 0, body);
    return true;
  }

  /** Scale s16le PCM by gainPct (0–100). */
  applyGainPcm(pcm, gainPct) {
    const g = Math.max(0, Math.min(100, Number(gainPct) || 0)) / 100;
    if (g === 1) return Buffer.from(pcm);
    const out = Buffer.allocUnsafe(pcm.length);
    for (let i = 0; i + 1 < pcm.length; i += 2) {
      let s = pcm.readInt16LE(i);
      s = Math.max(-32768, Math.min(32767, Math.round(s * g)));
      out.writeInt16LE(s, i);
    }
    return out;
  }

  /** TTS / inject — routed through RoomMixer so it mixes with mic uplink. */
  startPlayLoop(roomId, pcm, opts = {}) {
    if (!this.mixer) throw new Error("mixer not attached");
    this.mixer.startTts(roomId, pcm, opts);
    return () => this.stopPlayLoop(roomId);
  }

  stopPlayLoop(roomId) {
    return this.mixer?.stopTts(roomId) || false;
  }

  playLoopStatus(roomId) {
    return this.mixer?.ttsStatus(roomId) || null;
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, Math.round(n)));
}
