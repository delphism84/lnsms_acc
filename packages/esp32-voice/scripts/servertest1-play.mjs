/**
 * Keep WS presence as servertest1 in room esp1, and start PLAY TTS loop @ 80%.
 */
import WebSocket from "ws";

const ROOM = process.env.ROOM || "esp1";
const NAME = process.env.NAME || "servertest1";
const GAIN = Number(process.env.GAIN || 80);
const BASE = process.env.BASE || "https://voice.dualmodule.com";
const WS = process.env.WS || "wss://voice.dualmodule.com/ws";

async function startLoop() {
  const res = await fetch(`${BASE}/api/rooms/${encodeURIComponent(ROOM)}/play-loop`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "start", gain: GAIN, label: NAME }),
  });
  const body = await res.json();
  console.log("[play-loop]", res.status, JSON.stringify(body));
  return body;
}

function connect() {
  const ws = new WebSocket(WS);
  ws.on("open", () => {
    console.log("[ws] open → hello/join", NAME, ROOM);
    ws.send(JSON.stringify({ type: "hello", id: NAME, name: NAME }));
  });
  ws.on("message", async (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.type === "welcome") {
      ws.send(JSON.stringify({ type: "join", roomId: ROOM, id: NAME, name: NAME }));
      return;
    }
    if (msg.type === "joined") {
      console.log("[ws] joined", msg.roomId, "peers", (msg.peers || []).length, "members", msg.room?.memberCount);
      try {
        await startLoop();
      } catch (e) {
        console.error("[play-loop] failed", e);
      }
      return;
    }
    if (msg.type === "replaced") {
      console.log("[ws] replaced — exiting");
      process.exit(0);
    }
    if (msg.type === "chat") {
      console.log("[chat]", msg.name, msg.text);
    }
  });
  ws.on("close", () => {
    console.log("[ws] close — reconnect in 2s");
    setTimeout(connect, 2000);
  });
  ws.on("error", (e) => console.error("[ws] error", e.message));
}

console.log(`servertest1 bot → room=${ROOM} gain=${GAIN}%`);
connect();
