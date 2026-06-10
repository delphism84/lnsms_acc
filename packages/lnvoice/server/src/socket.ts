import type { Server, Socket } from "socket.io";
import { ChatMessage } from "./models/ChatMessage.js";

export type PeerInfo = {
  userId: string;
  socketId: string;
  micOn: boolean;
};

const roomPeers = new Map<string, Map<string, PeerInfo>>();

function getRoomMap(roomId: string): Map<string, PeerInfo> {
  let m = roomPeers.get(roomId);
  if (!m) {
    m = new Map();
    roomPeers.set(roomId, m);
  }
  return m;
}

function listPeers(roomId: string): PeerInfo[] {
  return [...getRoomMap(roomId).values()];
}

function emitRoomUsers(io: Server, roomId: string): void {
  io.to(roomId).emit("room-users", { peers: listPeers(roomId) });
}

const JOIN_LEAVE_RE =
  /님이 (입장|퇴장)했습니다\.?$/;

export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    let currentRoomId: string | null = null;
    let currentUserId: string | null = null;

    socket.on(
      "join-room",
      async ({ roomId, userId }: { roomId: string; userId: string }) => {
        if (!roomId || !userId) return;

        const alreadyInRoom =
          currentRoomId === roomId && currentUserId === userId;

        if (currentRoomId && !alreadyInRoom) {
          socket.leave(currentRoomId);
          const prev = getRoomMap(currentRoomId).get(socket.id);
          if (prev) {
            getRoomMap(currentRoomId).delete(socket.id);
            socket.to(currentRoomId).emit("user-left", {
              userId: prev.userId,
              socketId: socket.id,
            });
            emitRoomUsers(io, currentRoomId);
          }
        }

        if (alreadyInRoom) return;

        currentRoomId = roomId;
        currentUserId = userId;
        socket.join(roomId);

        getRoomMap(roomId).set(socket.id, {
          userId,
          socketId: socket.id,
          micOn: false,
        });

        const history = await ChatMessage.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(200)
          .lean();

        const filtered = history.filter(
          (m) =>
            m.kind !== "system" ||
            !JOIN_LEAVE_RE.test(String(m.text || ""))
        );

        socket.emit("chat-history", {
          messages: filtered.map((m) => ({
            id: String(m._id),
            roomId: m.roomId,
            userId: m.userId,
            text: m.text,
            kind: m.kind,
            createdAt:
              m.createdAt instanceof Date
                ? m.createdAt.toISOString()
                : String(m.createdAt),
          })),
        });

        socket.to(roomId).emit("user-joined", {
          userId,
          socketId: socket.id,
        });
        emitRoomUsers(io, roomId);
      }
    );

    socket.on("leave-room", () => {
      if (!currentRoomId || !currentUserId) return;
      const roomId = currentRoomId;
      const userId = currentUserId;
      socket.leave(roomId);
      getRoomMap(roomId).delete(socket.id);
      socket.to(roomId).emit("user-left", { userId, socketId: socket.id });
      emitRoomUsers(io, roomId);
      currentRoomId = null;
      currentUserId = null;
    });

    socket.on("mic-state", ({ roomId, on }: { roomId: string; on: boolean }) => {
      if (!currentRoomId || !currentUserId || roomId !== currentRoomId) return;
      const peer = getRoomMap(roomId).get(socket.id);
      if (peer) peer.micOn = Boolean(on);
      socket.to(roomId).emit("mic-state", {
        userId: currentUserId,
        socketId: socket.id,
        on: Boolean(on),
      });
      emitRoomUsers(io, roomId);
    });

    socket.on(
      "signal",
      (payload: {
        roomId: string;
        to: string;
        from: string;
        sdp?: unknown;
        candidate?: unknown;
      }) => {
        if (!payload?.to) return;
        io.to(payload.to).emit("signal", {
          ...payload,
          from: payload.from || socket.id,
        });
      }
    );

    socket.on(
      "chat-message",
      async ({
        roomId,
        userId,
        text,
      }: {
        roomId: string;
        userId: string;
        text: string;
      }) => {
        const trimmed = text?.trim();
        if (!roomId || !userId || !trimmed) return;
        const doc = await ChatMessage.create({
          roomId,
          userId,
          text: trimmed,
          kind: "user",
        });
        io.to(roomId).emit("chat-message", {
          id: String(doc._id),
          roomId,
          userId,
          text: trimmed,
          kind: "user",
          createdAt: doc.createdAt.toISOString(),
        });
      }
    );

    socket.on("disconnect", () => {
      if (!currentRoomId || !currentUserId) return;
      const roomId = currentRoomId;
      const userId = currentUserId;
      getRoomMap(roomId).delete(socket.id);
      socket.to(roomId).emit("user-left", { userId, socketId: socket.id });
      emitRoomUsers(io, roomId);
      if (getRoomMap(roomId).size === 0) roomPeers.delete(roomId);
      currentRoomId = null;
      currentUserId = null;
    });
  });
}
