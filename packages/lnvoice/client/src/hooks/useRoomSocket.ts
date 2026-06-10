import { useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket";

export type ChatMsg = {
  id?: string;
  roomId: string;
  userId: string;
  text: string;
  kind: "user" | "system";
  createdAt: string;
};

export type PeerInfo = {
  userId: string;
  socketId: string;
  micOn?: boolean;
};

const joinLeaveRe = /님이 (입장|퇴장)했습니다\.?$/;

export function useRoomSocket(roomId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [allPeers, setAllPeers] = useState<PeerInfo[]>([]);
  const joinedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomId || !userId) return;

    const joinKey = `${roomId}:${userId}`;
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onHistory = (data: { messages: ChatMsg[] }) => {
      setMessages(
        data.messages.filter(
          (m) => m.kind !== "system" || !joinLeaveRe.test(m.text)
        )
      );
    };

    const onChat = (msg: ChatMsg) => {
      if (msg.kind === "system" && joinLeaveRe.test(msg.text)) return;
      setMessages((prev) => [
        ...prev,
        { ...msg, createdAt: msg.createdAt || new Date().toISOString() },
      ]);
    };

    const onPeers = (data: { peers: PeerInfo[] }) => {
      setAllPeers(data.peers);
    };

    const onMicState = ({
      userId: uid,
      on,
    }: {
      userId: string;
      on: boolean;
    }) => {
      setAllPeers((prev) =>
        prev.map((p) => (p.userId === uid ? { ...p, micOn: on } : p))
      );
    };

    socket.on("chat-history", onHistory);
    socket.on("chat-message", onChat);
    socket.on("room-users", onPeers);
    socket.on("mic-state", onMicState);

    if (joinedKeyRef.current !== joinKey) {
      socket.emit("join-room", { roomId, userId });
      joinedKeyRef.current = joinKey;
    }

    return () => {
      socket.off("chat-history", onHistory);
      socket.off("chat-message", onChat);
      socket.off("room-users", onPeers);
      socket.off("mic-state", onMicState);
      if (joinedKeyRef.current === joinKey) {
        socket.emit("leave-room");
        joinedKeyRef.current = null;
      }
      setAllPeers([]);
    };
  }, [roomId, userId]);

  const peers = allPeers.filter((p) => p.userId !== userId);

  const sendMessage = (text: string) => {
    if (!roomId || !userId) return;
    getSocket().emit("chat-message", { roomId, userId, text });
  };

  return { messages, peers, allPeers, sendMessage };
}
