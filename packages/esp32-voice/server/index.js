/**
 * esp32-voice call server — CALL_PROTOCOL_V2 (server-first)
 * HTTP + WS on one port; ESP32 TCP on 9101–9104 (avoids 9001/9002 clash).
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { RoomHub } from "./room.js";
import { attachSignal } from "./signal.js";
import { IngestServer } from "./ingest.js";
import { RoomMixer } from "./mix.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const HTTP_PORT = Number(process.env.HTTP_PORT || 53110);
const PUBLIC_HOST = process.env.PUBLIC_HOST || "voice.dualmodule.com";

const INGEST = {
  video: Number(process.env.INGEST_VIDEO_PORT || 9101),
  audio: Number(process.env.INGEST_AUDIO_PORT || 9102),
  play: Number(process.env.INGEST_PLAY_PORT || 9103),
  ctrl: Number(process.env.INGEST_CTRL_PORT || 9104),
};

const iceServers = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  {
    urls: [
      `turn:${process.env.TURN_HOST || "66.42.58.63"}:3478`,
      `turn:${process.env.TURN_HOST || "66.42.58.63"}:3478?transport=tcp`,
    ],
    username: process.env.TURN_USER || "esp32",
    credential: process.env.TURN_PASS || "9c57e9be3b87cfb696a668e08a56128e",
  },
];

const rooms = new RoomHub();
const ingest = new IngestServer(INGEST, rooms);
const mixer = new RoomMixer(ingest);
ingest.setMixer(mixer);

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(ROOT, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    host: PUBLIC_HOST,
    proto: "CALL_PROTOCOL_V2",
    ingest: INGEST,
    rooms: rooms.list().length,
    devices: ingest.listDevices().length,
  });
});

app.get("/api/rooms", (_req, res) => {
  res.json({ rooms: rooms.list() });
});

app.post("/api/rooms", (req, res) => {
  const id = String(req.body?.id || "").trim();
  const name = String(req.body?.name || id || "room").slice(0, 64);
  const room = rooms.create(id || undefined, { name });
  if (name && room.name !== name) room.name = name;
  res.status(201).json({ room: room.toJSON() });
});

app.get("/api/rooms/:id", (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: "not found" });
  res.json({ room: room.toJSON() });
});

app.get("/api/devices", (_req, res) => {
  res.json({ devices: ingest.listDevices() });
});

app.post("/api/devices/:id/gain", (req, res) => {
  const mic = num(req.body?.mic);
  const spk = num(req.body?.spk);
  const ok = ingest.sendToDevice(req.params.id, {
    cmd: "set_gain",
    ...(mic != null ? { mic } : {}),
    ...(spk != null ? { spk } : {}),
  });
  if (!ok) return res.status(404).json({ error: "device offline or no CTRL" });
  res.json({ ok: true });
});

app.post("/api/devices/:id/mute", (req, res) => {
  const ok = ingest.sendToDevice(req.params.id, {
    cmd: "mute",
    mic: !!req.body?.mic,
    spk: !!req.body?.spk,
  });
  if (!ok) return res.status(404).json({ error: "device offline or no CTRL" });
  res.json({ ok: true });
});

app.post("/api/devices/:id/idr", (req, res) => {
  const ok = ingest.sendToDevice(req.params.id, { cmd: "request_idr" });
  if (!ok) return res.status(404).json({ error: "device offline or no CTRL" });
  res.json({ ok: true });
});

app.post("/api/devices/:id/join", (req, res) => {
  const roomId = String(req.body?.room_id || "").trim();
  if (!roomId) return res.status(400).json({ error: "room_id required" });
  const room = rooms.ensure(roomId);
  const sess = ingest.devices.get(req.params.id);
  if (sess?.roomId && sess.roomId !== roomId) {
    rooms.get(sess.roomId)?.removeDevice(sess.deviceId);
  }
  const ok = ingest.sendToDevice(req.params.id, {
    cmd: "join",
    room_id: roomId,
    role: req.body?.role || "endpoint",
  });
  if (sess) {
    sess.roomId = roomId;
    sess.callState = "active";
    room.addDevice({
      id: sess.deviceId,
      name: sess.deviceId,
      mutedIn: sess.micMuted,
      mutedOut: sess.spkMuted,
      micGain: sess.micGain,
      spkGain: sess.spkGain,
      online: true,
    });
  }
  if (!ok) return res.status(404).json({ error: "device offline or no CTRL", room: room.toJSON() });
  res.json({ ok: true, room: room.toJSON() });
});

/** POST chat into a room (WS viewers + device CTRL). */
app.post("/api/rooms/:id/chat", (req, res) => {
  const roomId = String(req.params.id || "").trim();
  const text = String(req.body?.text || "").trim().slice(0, 500);
  if (!roomId || !text) return res.status(400).json({ error: "text required" });
  if (!rooms.get(roomId)) return res.status(404).json({ error: "room not found" });
  const chat = {
    type: "chat",
    from: "api",
    name: String(req.body?.name || "api").slice(0, 64),
    text,
    t: Date.now(),
  };
  signal.broadcastRoom?.(roomId, chat, null);
  const devices = ingest.forwardChatToRoom(roomId, chat);
  res.json({ ok: true, devices });
});

/** Start/stop paced PLAY PCM loop to all devices in room (talkback / server test). */
app.post("/api/rooms/:id/play-loop", (req, res) => {
  const roomId = String(req.params.id || "").trim();
  const action = String(req.body?.action || "start").toLowerCase();
  const gainPct = Math.max(0, Math.min(100, Number(req.body?.gain ?? 80)));
  const label = String(req.body?.label || "servertest1").slice(0, 64);
  const room = rooms.ensure(roomId);

  if (action === "stop") {
    const stopped = ingest.stopPlayLoop(roomId);
    room.removeMember(label);
    signal.broadcastRoom?.(roomId, { type: "room-update", room: room.toJSON() }, null);
    signal.broadcastRoom?.(
      roomId,
      { type: "play-loop", running: false, roomId, label },
      null,
    );
    return res.json({ ok: true, stopped, room: room.toJSON() });
  }

  const pcmPath = String(req.body?.pcmPath || path.join(ROOT, "tmp", "servertest1.pcm"));
  const audioUrl = String(req.body?.audioUrl || "/servertest1.mp3");
  let pcm;
  try {
    pcm = fs.readFileSync(pcmPath);
  } catch {
    return res.status(404).json({ error: `pcm not found: ${pcmPath}` });
  }

  // Join as viewer label so UI lists servertest1
  room.addMember({
    id: label,
    name: label,
    role: "viewer",
    mutedIn: true,
    mutedOut: false,
    micGain: 0,
    spkGain: gainPct,
  });

  // Push speaker gain to devices
  for (const sess of ingest.devices.values()) {
    if (sess.roomId !== roomId) continue;
    ingest.sendToDevice(sess.deviceId, { cmd: "set_gain", spk: gainPct });
  }

  ingest.startPlayLoop(roomId, pcm, { gainPct, label, audioUrl });
  const loop = ingest.playLoopStatus(roomId);
  signal.broadcastRoom?.(roomId, { type: "room-update", room: room.toJSON() }, null);
  signal.broadcastRoom?.(
    roomId,
    { type: "play-loop", running: true, roomId, label, gainPct, audioUrl, loop },
    null,
  );
  res.json({
    ok: true,
    roomId,
    label,
    gainPct,
    audioUrl,
    pcmBytes: pcm.length,
    loop,
    room: room.toJSON(),
    note: "RoomMixer: viewer uplink + ESP AFRM + TTS → exclude-self PLAY to ESP.",
  });
});

app.get("/api/rooms/:id/play-loop", (req, res) => {
  const roomId = String(req.params.id || "").trim();
  res.json({ loop: ingest.playLoopStatus(roomId), room: rooms.get(roomId)?.toJSON() || null });
});

app.get("/api/ice", (_req, res) => {
  res.json({ iceServers });
});

const server = http.createServer(app);
const signal = attachSignal(server, {
  rooms,
  iceServers,
  ingest,
  onBroadcast: () => {},
});

ingest.on("device", (sess) => {
  if (!sess?.roomId) return;
  const room = rooms.get(sess.roomId);
  if (!room) return;
  signal.broadcastRoom?.(sess.roomId, { type: "room-update", room: room.toJSON() }, null);
});

ingest.start();

server.listen(HTTP_PORT, "127.0.0.1", () => {
  console.log(`[esp32-voice] http+ws 127.0.0.1:${HTTP_PORT}  public=${PUBLIC_HOST}`);
});

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}
