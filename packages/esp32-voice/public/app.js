/**
 * Light mesh WebRTC client — mic/speaker device + gain/mute controls.
 */
const $ = (id) => document.getElementById(id);

const state = {
  id: null,
  roomId: null,
  ws: null,
  iceServers: [],
  localStream: null,
  audioCtx: null,
  micGainNode: null,
  processedStream: null,
  peers: new Map(), // id -> { pc, audio, name }
  endpoints: [], // ESP devices from /api room members (kind=device)
  viewers: [], // non-WebRTC viewers (e.g. servertest1 inject)
  roomPoll: null,
  micMuted: false,
  spkMuted: false,
  micGain: 100,
  spkGain: 100,
  meterTimer: null,
  replaced: false,
  roomAudio: null, // HTMLAudioElement for server play-loop (TTS) → phone/browser
  roomAudioUrl: null,
  joinedName: null, // set only after 입장 — until then do not claim guest id
  localLevel: 0,
  peerLevelTimer: null,
};

function setConn(ok) {
  const el = $("conn");
  el.textContent = ok ? "연결됨" : "연결 끊김";
  el.className = "pill " + (ok ? "ok" : "off");
}

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function connect() {
  const ws = new WebSocket(wsUrl());
  state.ws = ws;
  ws.onopen = () => {
    setConn(true);
    // Do NOT hello as "guest" on page load — that kicks others with same name.
    // Use ephemeral id until user presses 입장 (or re-join after reconnect).
    if (state.joinedName && state.roomId) {
      ws.send(JSON.stringify({ type: "hello", id: state.joinedName, name: state.joinedName }));
    } else {
      const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}`;
      ws.send(JSON.stringify({ type: "hello", id: tempId, name: "anon" }));
    }
  };
  ws.onclose = () => {
    setConn(false);
    if (state.replaced) return;
    setTimeout(connect, 1500);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "replaced") {
      state.replaced = true;
      state.joinedName = null;
      appendChat("system", "같은 ID로 새 접속이 들어와 이 탭 연결이 종료되었습니다");
      $("btnJoin").disabled = false;
      $("btnLeave").disabled = true;
      state.roomId = null;
      state.endpoints = [];
      stopRoomPoll();
      stopRoomPlayLoop();
      for (const id of [...state.peers.keys()]) closePeer(id);
      renderPeers();
      return;
    }
    if (msg.type === "welcome") {
      state.id = msg.id;
      state.iceServers = msg.iceServers || [];
      state.replaced = false;
      // WS dropped while in-room → re-join only if user had pressed 입장
      if (state.roomId && state.joinedName) {
        send({
          type: "join",
          roomId: state.roomId,
          id: state.joinedName,
          name: state.joinedName,
        });
      }
      return;
    }
    if (msg.type === "joined") {
      state.roomId = msg.roomId;
      state.joinedName = ($("name").value || "guest").trim().slice(0, 32);
      $("btnJoin").disabled = true;
      $("btnLeave").disabled = false;
      await ensureMic();
      for (const p of msg.peers || []) await ensurePeer(p.id, p.name, true);
      applyRoomMembers(msg.room);
      startRoomPoll();
      renderPeers();
      await syncRoomPlayLoop();
      return;
    }
    if (msg.type === "peer-joined") {
      await ensureMic();
      await ensurePeer(msg.id, msg.name, true);
      renderPeers();
      return;
    }
    if (msg.type === "peer-left") {
      closePeer(msg.id);
      renderPeers();
      return;
    }
    if (msg.type === "room-update") {
      applyRoomMembers(msg.room);
      renderPeers();
      return;
    }
    if (msg.type === "play-loop") {
      if (msg.running) {
        await startRoomPlayLoop({
          audioUrl: msg.audioUrl || msg.loop?.audioUrl || "/servertest1.mp3",
          gainPct: msg.gainPct ?? msg.loop?.gainPct ?? 80,
        });
      } else {
        stopRoomPlayLoop();
      }
      return;
    }
    if (msg.type === "signal") {
      await onSignal(msg.from, msg.payload);
      return;
    }
    if (msg.type === "chat") {
      if (msg.echo) {
        appendChat(`${msg.name || msg.from} (echo)`, msg.text);
      } else {
        appendChat(msg.name || msg.from, msg.text);
      }
      return;
    }
    if (msg.type === "peer-state") {
      renderPeers();
    }
  };
}

function applyRoomMembers(room) {
  const members = room?.members || [];
  state.endpoints = members.filter((m) => m.kind === "device");
  state.viewers = members.filter((m) => m.kind === "viewer");
}

function startRoomPoll() {
  stopRoomPoll();
  state.roomPoll = setInterval(async () => {
    if (!state.roomId) return;
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(state.roomId)}`);
      if (!res.ok) return;
      const data = await res.json();
      applyRoomMembers(data.room);
      renderPeers();
    } catch {
      /* ignore */
    }
  }, 2500);
}

function stopRoomPoll() {
  if (state.roomPoll) {
    clearInterval(state.roomPoll);
    state.roomPoll = null;
  }
}

function ensureRoomAudioEl() {
  if (state.roomAudio) return state.roomAudio;
  const a = new Audio();
  a.loop = true;
  a.preload = "auto";
  a.playsInline = true;
  a.setAttribute("playsinline", "true");
  a.crossOrigin = "anonymous";
  state.roomAudio = a;
  return a;
}

/** iOS/Android: unlock audio inside the Join tap gesture. */
async function unlockRoomAudio() {
  const a = ensureRoomAudioEl();
  const prev = a.src;
  // short silent wav
  a.src =
    "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  a.volume = 0.01;
  try {
    await a.play();
  } catch {
    /* ignore */
  }
  a.pause();
  a.currentTime = 0;
  if (prev) a.src = prev;
}

async function startRoomPlayLoop({ audioUrl, gainPct }) {
  if (!state.roomId) return;
  const url = audioUrl || "/servertest1.mp3";
  const a = ensureRoomAudioEl();
  const g = Number(gainPct) || 80;
  a.dataset.gainPct = String(g);
  const vol = Math.max(0, Math.min(1, g / 100)) * (state.spkMuted ? 0 : state.spkGain / 100);
  if (state.roomAudioUrl !== url) {
    a.src = url;
    state.roomAudioUrl = url;
  }
  a.loop = true;
  a.volume = vol;
  try {
    await a.play();
    if (!state._ttsNoted) {
      appendChat("system", `룸 TTS 재생 중 (서버 ${g}% × 스피커 ${state.spkGain}%)`);
      state._ttsNoted = true;
    }
  } catch (e) {
    appendChat("system", `룸 TTS 재생 실패 — 다시 입장을 눌러 주세요 (${e.message || e})`);
  }
}

function stopRoomPlayLoop() {
  if (!state.roomAudio) return;
  try {
    state.roomAudio.pause();
    state.roomAudio.currentTime = 0;
  } catch {
    /* ignore */
  }
}

async function syncRoomPlayLoop() {
  if (!state.roomId) return;
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(state.roomId)}/play-loop`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.loop?.running) {
      await startRoomPlayLoop({
        audioUrl: data.loop.audioUrl || "/servertest1.mp3",
        gainPct: data.loop.gainPct ?? 80,
      });
    } else {
      stopRoomPlayLoop();
    }
  } catch {
    /* ignore */
  }
}

function applyRoomAudioVolume() {
  if (!state.roomAudio) return;
  const base = state.roomAudio.dataset.gainPct
    ? Number(state.roomAudio.dataset.gainPct) / 100
    : 0.8;
  state.roomAudio.volume = Math.max(
    0,
    Math.min(1, base * (state.spkMuted ? 0 : state.spkGain / 100)),
  );
}

function send(msg) {
  if (state.ws?.readyState === 1) state.ws.send(JSON.stringify(msg));
}

async function listDevices() {
  // Do not prompt mic on page load — only enumerate (labels may be empty until 입장).
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === "audioinput");
    const spks = devices.filter((d) => d.kind === "audiooutput");
    fillSelect($("micSelect"), mics);
    fillSelect($("spkSelect"), spks);
  } catch {
    /* ignore */
  }
}

function fillSelect(sel, devices) {
  const cur = sel.value;
  sel.innerHTML = "";
  for (const d of devices) {
    const opt = document.createElement("option");
    opt.value = d.deviceId;
    opt.textContent = d.label || `${d.kind} ${d.deviceId.slice(0, 6)}`;
    sel.appendChild(opt);
  }
  if (cur) sel.value = cur;
}

async function ensureMic() {
  const deviceId = $("micSelect").value || undefined;
  const constraints = {
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    },
    video: false,
  };
  if (state.localStream) {
    state.localStream.getTracks().forEach((t) => t.stop());
  }
  const raw = await navigator.mediaDevices.getUserMedia(constraints);
  state.localStream = raw;

  // Web Audio gain graph for mic volume
  if (state.audioCtx) await state.audioCtx.close().catch(() => {});
  const ctx = new AudioContext();
  state.audioCtx = ctx;
  const src = ctx.createMediaStreamSource(raw);
  const gain = ctx.createGain();
  gain.gain.value = state.micMuted ? 0 : state.micGain / 100;
  state.micGainNode = gain;
  const dest = ctx.createMediaStreamDestination();
  src.connect(gain).connect(dest);
  // keep analyser for meter
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  gain.connect(analyser);
  state.analyser = analyser;
  state.processedStream = dest.stream;

  // replace tracks on existing PCs
  for (const [, peer] of state.peers) {
    const sender = peer.pc.getSenders().find((s) => s.track?.kind === "audio");
    const track = state.processedStream.getAudioTracks()[0];
    if (sender && track) await sender.replaceTrack(track);
  }
  startMeter();
}

function startMeter() {
  cancelAnimationFrame(state.meterTimer);
  const data = new Uint8Array(state.analyser?.frequencyBinCount || 0);
  const tick = () => {
    if (state.analyser) {
      state.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const v of data) sum += v;
      const avg = data.length ? sum / data.length / 255 : 0;
      state.localLevel = Math.min(100, Math.round(avg * 180));
      $("micMeter").style.width = `${Math.min(100, avg * 180)}%`;
      if (state.roomId) renderPeers();
    }
    state.meterTimer = requestAnimationFrame(tick);
  };
  tick();
}

function attachPeerMeter(peer, stream) {
  if (!stream) return;
  try {
    const ctx = state.audioCtx || new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    peer.srcNode = src;
    peer.analyser = analyser;
    peer.level = 0;
  } catch {
    peer.analyser = null;
  }
}

function startPeerLevelLoop() {
  if (state.peerLevelTimer) return;
  const tick = () => {
    let changed = false;
    for (const [, peer] of state.peers) {
      if (!peer.analyser) continue;
      const data = new Uint8Array(peer.analyser.frequencyBinCount);
      peer.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const v of data) sum += v;
      const level = data.length ? Math.min(100, Math.round((sum / data.length / 255) * 180)) : 0;
      if (peer.level !== level) {
        peer.level = level;
        changed = true;
      }
    }
    if (changed && state.roomId) renderPeers();
    state.peerLevelTimer = requestAnimationFrame(tick);
  };
  state.peerLevelTimer = requestAnimationFrame(tick);
}

async function ensurePeer(id, name, polite) {
  if (id === state.id || state.peers.has(id)) return;
  const pc = new RTCPeerConnection({ iceServers: state.iceServers });
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.playsInline = true;
  audio.dataset.peer = id;
  $("remoteAudio").appendChild(audio);
  applySpkVolume(audio);

  const peer = { pc, audio, name: name || id, makingOffer: false, ignoreOffer: false, polite };
  state.peers.set(id, peer);

  const track = state.processedStream?.getAudioTracks()[0] || state.localStream?.getAudioTracks()[0];
  if (track) pc.addTrack(track, state.processedStream || state.localStream);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      send({ type: "signal", to: id, payload: { candidate: e.candidate } });
    }
  };
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
    attachPeerMeter(peer, e.streams[0]);
    startPeerLevelLoop();
    applySink(audio);
    applySpkVolume(audio);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") pc.restartIce();
    renderPeers();
  };

  // Perfect negotiation (simplified)
  pc.onnegotiationneeded = async () => {
    try {
      peer.makingOffer = true;
      await pc.setLocalDescription(await pc.createOffer());
      send({ type: "signal", to: id, payload: { sdp: pc.localDescription } });
    } catch (e) {
      console.warn(e);
    } finally {
      peer.makingOffer = false;
    }
  };
}

async function onSignal(from, payload) {
  let peer = state.peers.get(from);
  if (!peer) {
    await ensureMic();
    await ensurePeer(from, from, false);
    peer = state.peers.get(from);
  }
  const pc = peer.pc;

  if (payload.sdp) {
    const desc = payload.sdp;
    const offerCollision =
      desc.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
    peer.ignoreOffer = !peer.polite && offerCollision;
    if (peer.ignoreOffer) return;
    await pc.setRemoteDescription(desc);
    if (desc.type === "offer") {
      await pc.setLocalDescription(await pc.createAnswer());
      send({ type: "signal", to: from, payload: { sdp: pc.localDescription } });
    }
  } else if (payload.candidate) {
    try {
      await pc.addIceCandidate(payload.candidate);
    } catch (e) {
      if (!peer.ignoreOffer) console.warn(e);
    }
  }
}

function closePeer(id) {
  const peer = state.peers.get(id);
  if (!peer) return;
  peer.pc.close();
  peer.audio.remove();
  if (peer.srcNode) peer.srcNode.disconnect?.();
  state.peers.delete(id);
}

function renderPeers() {
  const ul = $("peers");
  ul.innerHTML = "";
  const ep = state.endpoints || [];
  const viewers = (state.viewers || []).filter((v) => v.id !== state.id && v.id !== ($("name").value || "").trim());
  $("peerCount").textContent = String(
    state.peers.size + ep.length + viewers.length + (state.roomId ? 1 : 0),
  );
  if (state.roomId) {
    const li = document.createElement("li");
    li.innerHTML = peerRowHtml({
      dotClass: "me",
      name: `${$("name").value || "me"} (나)`,
      meta: state.micMuted ? "muted" : "mic",
      level: state.micMuted ? 0 : state.localLevel,
      active: !state.micMuted && state.localLevel > 2,
    });
    ul.appendChild(li);
  }
  for (const d of ep) {
    const li = document.createElement("li");
    const online = d.online !== false;
    li.innerHTML = peerRowHtml({
      dotClass: online ? "on" : "",
      name: `${escapeHtml(d.name || d.id)} <span class="muted">ESP</span>`,
      meta: online ? (d.audioActive ? "audio" : "idle") : "offline",
      level: d.audioLevel || 0,
      active: !!d.audioActive,
      trustedName: true,
    });
    ul.appendChild(li);
  }
  for (const v of viewers) {
    if (state.peers.has(v.id)) continue;
    const li = document.createElement("li");
    li.innerHTML = peerRowHtml({
      dotClass: "on",
      name: escapeHtml(v.name || v.id),
      meta: v.audioActive ? "audio" : "server",
      level: v.audioLevel || 0,
      active: !!v.audioActive,
      trustedName: true,
    });
    ul.appendChild(li);
  }
  for (const [id, p] of state.peers) {
    const li = document.createElement("li");
    const st = p.pc.connectionState || "";
    li.innerHTML = peerRowHtml({
      dotClass: "",
      name: escapeHtml(p.name),
      meta: st || "peer",
      level: p.level || 0,
      active: (p.level || 0) > 2,
      trustedName: true,
    });
    ul.appendChild(li);
  }
}

function peerRowHtml({ dotClass = "", name, meta, level = 0, active = false, trustedName = false }) {
  const safeName = trustedName ? name : escapeHtml(name);
  const pct = Math.max(0, Math.min(100, Math.round(level || 0)));
  return `<span class="dot ${dotClass}"></span><span class="peer-name">${safeName}</span><span class="peer-meta muted">${escapeHtml(meta || "")}</span><span class="peer-level ${active ? "active" : ""}"><i style="width:${pct}%"></i></span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function applySpkVolume(audio) {
  audio.muted = state.spkMuted;
  audio.volume = state.spkMuted ? 0 : state.spkGain / 100;
}

function applyAllSpk() {
  for (const [, p] of state.peers) applySpkVolume(p.audio);
  applyRoomAudioVolume();
}

async function applySink(audio) {
  const id = $("spkSelect").value;
  if (id && typeof audio.setSinkId === "function") {
    try {
      await audio.setSinkId(id);
    } catch (e) {
      console.warn("setSinkId", e);
    }
  }
}

async function applySinkAll() {
  for (const [, p] of state.peers) await applySink(p.audio);
  if (state.roomAudio) await applySink(state.roomAudio);
}

function publishState() {
  send({
    type: "state",
    mutedIn: state.micMuted,
    mutedOut: state.spkMuted,
    micGain: state.micGain,
    spkGain: state.spkGain,
  });
}

function appendChat(name, text) {
  const div = document.createElement("div");
  div.innerHTML = `<span class="meta">${escapeHtml(name)}</span>${escapeHtml(text)}`;
  $("chatLog").appendChild(div);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}

// UI bindings
$("btnJoin").onclick = async () => {
  state._ttsNoted = false;
  // Mobile browsers require play() inside a user gesture
  await unlockRoomAudio();
  const name = ($("name").value || "guest").trim().slice(0, 32);
  // Claim identity + enter room only on explicit 입장
  send({ type: "join", roomId: $("room").value || "esp1", id: name, name });
};
$("btnLeave").onclick = () => {
  send({ type: "leave" });
  for (const id of [...state.peers.keys()]) closePeer(id);
  state.roomId = null;
  state.joinedName = null;
  state.endpoints = [];
  stopRoomPoll();
  stopRoomPlayLoop();
  $("btnJoin").disabled = false;
  $("btnLeave").disabled = true;
  renderPeers();
};

$("btnMuteMic").onclick = () => {
  state.micMuted = !state.micMuted;
  $("btnMuteMic").classList.toggle("on", state.micMuted);
  $("btnMuteMic").textContent = state.micMuted ? "🔇" : "🎤";
  if (state.micGainNode) state.micGainNode.gain.value = state.micMuted ? 0 : state.micGain / 100;
  state.localStream?.getAudioTracks().forEach((t) => {
    t.enabled = !state.micMuted;
  });
  publishState();
};

$("btnMuteSpk").onclick = () => {
  state.spkMuted = !state.spkMuted;
  $("btnMuteSpk").classList.toggle("on", state.spkMuted);
  $("btnMuteSpk").textContent = state.spkMuted ? "🔈" : "🔊";
  applyAllSpk();
  publishState();
};

$("micGain").oninput = (e) => {
  state.micGain = Number(e.target.value);
  $("micGainVal").textContent = String(state.micGain);
  if (state.micGainNode && !state.micMuted) state.micGainNode.gain.value = state.micGain / 100;
  publishState();
};
$("spkGain").oninput = (e) => {
  state.spkGain = Number(e.target.value);
  $("spkGainVal").textContent = String(state.spkGain);
  applyAllSpk();
  publishState();
};

$("micSelect").onchange = () => {
  if (state.roomId) ensureMic();
};
$("spkSelect").onchange = () => applySinkAll();

$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("chatInput").value.trim();
  if (!text) return;
  /* Wait for server echo to confirm round-trip (shown as "name (echo)"). */
  send({ type: "chat", text });
  $("chatInput").value = "";
};

navigator.mediaDevices?.addEventListener("devicechange", listDevices);
listDevices();
connect();
