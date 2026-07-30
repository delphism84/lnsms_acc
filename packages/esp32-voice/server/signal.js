/** WebSocket signaling for browser mesh WebRTC + room events */
import { WebSocketServer } from "ws";
import { randomId } from "./room.js";

export function attachSignal(server, { rooms, iceServers, onBroadcast, ingest }) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  /** viewerId -> { ws, roomId, name } */
  const clients = new Map();

  function send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function broadcastRoom(roomId, msg, exceptId) {
    for (const [id, c] of clients) {
      if (c.roomId === roomId && id !== exceptId) send(c.ws, msg);
    }
  }

  function roomState(roomId) {
    const room = rooms.get(roomId);
    return room ? room.toJSON() : null;
  }

  /** Same id → kill previous socket so only the newest client remains. */
  function kickDuplicate(id, newWs) {
    const prev = clients.get(id);
    if (!prev || prev.ws === newWs) return;
    try {
      send(prev.ws, { type: "replaced", reason: "duplicate_id", id });
    } catch {
      /* ignore */
    }
    if (prev.roomId) {
      rooms.get(prev.roomId)?.removeMember(id);
      broadcastRoom(prev.roomId, { type: "peer-left", id }, id);
      rooms.gc();
    }
    try {
      prev.ws.close();
    } catch {
      /* ignore */
    }
    clients.delete(id);
    console.log(`[signal] duplicate id=${id} — killed previous connection`);
  }

  wss.on("connection", (ws) => {
    let viewerId = null;

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (msg.type === "hello") {
        const name = String(msg.name || "guest").trim().slice(0, 32) || "guest";
        const requested = String(msg.id || name).trim().slice(0, 32);
        viewerId = requested || randomId(10);
        kickDuplicate(viewerId, ws);
        clients.set(viewerId, { ws, roomId: null, name });
        send(ws, { type: "welcome", id: viewerId, iceServers });
        return;
      }

      if (!viewerId) return;
      const client = clients.get(viewerId);
      if (!client || client.ws !== ws) return;

      if (msg.type === "join") {
        const roomId = String(msg.roomId || "esp1").slice(0, 64);
        const name = String(msg.name || client.name || "guest").trim().slice(0, 32) || "guest";
        const joinId = String(msg.id || viewerId).trim().slice(0, 32) || viewerId;

        if (joinId !== viewerId) {
          kickDuplicate(joinId, ws);
          clients.delete(viewerId);
          if (client.roomId) {
            rooms.get(client.roomId)?.removeMember(viewerId);
            broadcastRoom(client.roomId, { type: "peer-left", id: viewerId }, viewerId);
          }
          viewerId = joinId;
          client.roomId = null;
          clients.set(viewerId, client);
        }

        if (client.roomId) {
          const prev = rooms.get(client.roomId);
          prev?.removeMember(viewerId);
          broadcastRoom(client.roomId, { type: "peer-left", id: viewerId }, viewerId);
        }
        const room = rooms.ensure(roomId);
        client.name = name;
        client.roomId = roomId;
        room.addMember({
          id: viewerId,
          name,
          role: "viewer",
          mutedIn: false,
          mutedOut: false,
          micGain: 100,
          spkGain: 100,
        });
        const peers = [...room.members.keys()].filter((id) => id !== viewerId);
        send(ws, {
          type: "joined",
          roomId,
          peers: peers.map((id) => {
            const m = room.members.get(id);
            return { id, name: m?.name || id };
          }),
          room: room.toJSON(),
        });
        broadcastRoom(roomId, { type: "peer-joined", id: viewerId, name }, viewerId);
        onBroadcast?.();
        return;
      }

      if (msg.type === "leave") {
        if (client.roomId) {
          rooms.get(client.roomId)?.removeMember(viewerId);
          broadcastRoom(client.roomId, { type: "peer-left", id: viewerId }, viewerId);
          client.roomId = null;
          rooms.gc();
          onBroadcast?.();
        }
        return;
      }

      // WebRTC relay: offer / answer / ice
      if (msg.type === "signal" && msg.to && msg.payload) {
        const target = clients.get(msg.to);
        if (target) {
          send(target.ws, {
            type: "signal",
            from: viewerId,
            payload: msg.payload,
          });
        }
        return;
      }

      if (msg.type === "state") {
        if (client.roomId) {
          const room = rooms.get(client.roomId);
          const m = room?.members.get(viewerId);
          if (m) {
            if (typeof msg.mutedIn === "boolean") m.mutedIn = msg.mutedIn;
            if (typeof msg.mutedOut === "boolean") m.mutedOut = msg.mutedOut;
            if (typeof msg.micGain === "number") m.micGain = clamp(msg.micGain, 0, 100);
            if (typeof msg.spkGain === "number") m.spkGain = clamp(msg.spkGain, 0, 100);
            broadcastRoom(
              client.roomId,
              { type: "peer-state", id: viewerId, member: { ...m } },
              null,
            );
          }
        }
        return;
      }

      if (msg.type === "chat" && client.roomId && typeof msg.text === "string") {
        const chat = {
          type: "chat",
          from: viewerId,
          name: client.name,
          text: msg.text.slice(0, 500),
          t: Date.now(),
        };
        broadcastRoom(client.roomId, chat, viewerId);
        const n = ingest?.forwardChatToRoom?.(client.roomId, chat) || 0;
        if (n) console.log(`[signal] chat -> ${n} device(s) room=${client.roomId}`);
        send(client.ws, { ...chat, echo: true });
      }
    });

    ws.on("close", () => {
      if (!viewerId) return;
      const client = clients.get(viewerId);
      // Already replaced by a newer connection with the same id
      if (!client || client.ws !== ws) return;
      if (client.roomId) {
        rooms.get(client.roomId)?.removeMember(viewerId);
        broadcastRoom(client.roomId, { type: "peer-left", id: viewerId }, viewerId);
        rooms.gc();
        onBroadcast?.();
      }
      clients.delete(viewerId);
    });
  });

  return { wss, clients, roomState, broadcastRoom };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, Math.round(Number(n) || 0)));
}
