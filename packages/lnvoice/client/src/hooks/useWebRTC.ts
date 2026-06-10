import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, waitForSocket } from "../lib/socket";
import type { PeerInfo } from "./useRoomSocket";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function shouldOffer(a: string, b: string): boolean {
  return a.localeCompare(b) < 0;
}

/** impolite = offer initiator(작은 ID). 충돌 시 큰 ID가 rollback */
function isPolite(localId: string, remoteId: string): boolean {
  return localId > remoteId;
}

function cloneStream(stream: MediaStream): MediaStream {
  return new MediaStream(stream.getTracks());
}

export function useWebRTC(
  roomId: string | null,
  userId: string | null,
  micOn: boolean,
  peers: PeerInfo[],
  onPermissionError?: () => void
) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    () => new Map()
  );
  const [remoteTrackKeys, setRemoteTrackKeys] = useState<Map<string, string>>(
    () => new Map()
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [rtcStatus, setRtcStatus] = useState<string>("");
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketToUserRef = useRef<Map<string, string>>(new Map());
  const userToSocketRef = useRef<Map<string, string>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const micOnRef = useRef(micOn);
  const peersRef = useRef(peers);
  const handlersBoundRef = useRef(false);

  micOnRef.current = micOn;
  peersRef.current = peers;

  const bumpTrackKey = useCallback((uid: string) => {
    setRemoteTrackKeys((prev) => {
      const next = new Map(prev);
      next.set(uid, `${Date.now()}-${Math.random()}`);
      return next;
    });
  }, []);

  const setRemote = useCallback(
    (uid: string, stream: MediaStream | null) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        if (stream && stream.getAudioTracks().length > 0) {
          next.set(uid, cloneStream(stream));
          bumpTrackKey(uid);
        } else {
          next.delete(uid);
        }
        return next;
      });
      setConnectedPeers((prev) => {
        if (stream?.getAudioTracks().length) {
          return prev.includes(uid) ? prev : [...prev, uid];
        }
        return prev.filter((id) => id !== uid);
      });
    },
    [bumpTrackKey]
  );

  const flushIce = useCallback(async (uid: string, pc: RTCPeerConnection) => {
    const q = iceQueueRef.current.get(uid) ?? [];
    iceQueueRef.current.delete(uid);
    for (const c of q) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const removePeer = useCallback(
    (remoteUserId: string) => {
      const pc = pcsRef.current.get(remoteUserId);
      pc?.close();
      pcsRef.current.delete(remoteUserId);
      iceQueueRef.current.delete(remoteUserId);
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(remoteUserId);
        return next;
      });
      setRemoteTrackKeys((prev) => {
        const next = new Map(prev);
        next.delete(remoteUserId);
        return next;
      });
      setConnectedPeers((prev) => prev.filter((id) => id !== remoteUserId));
    },
    []
  );

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const local = localStreamRef.current;
    if (!local) return;
    const audioTrack = local.getAudioTracks()[0];
    if (!audioTrack) return;

    const senders = pc.getSenders().filter((s) => s.track?.kind === "audio");
    if (senders.length > 0) {
      for (const s of senders) void s.replaceTrack(audioTrack);
    } else {
      pc.addTrack(audioTrack, local);
    }
  }, []);

  const createPc = useCallback(
    (remote: PeerInfo) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcsRef.current.set(remote.userId, pc);
      socketToUserRef.current.set(remote.socketId, remote.userId);
      userToSocketRef.current.set(remote.userId, remote.socketId);

      pc.ontrack = (ev) => {
        if (ev.track.kind !== "audio") return;
        const ms =
          ev.streams?.[0] ?? new MediaStream([ev.track]);
        setRemote(remote.userId, ms);
        setRtcStatus(`${remote.userId} 오디오 수신`);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !roomId) return;
        const sock = getSocket();
        if (!sock.id) return;
        sock.emit("signal", {
          roomId,
          to: remote.socketId,
          from: sock.id,
          candidate: ev.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        setRtcStatus(`${remote.userId}: ${pc.connectionState}`);
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          removePeer(remote.userId);
        }
      };

      attachLocalTracks(pc);
      return pc;
    },
    [roomId, setRemote, removePeer, attachLocalTracks]
  );

  const sendOffer = useCallback(
    async (remote: PeerInfo) => {
      if (!roomId || !userId) return;
      let pc = pcsRef.current.get(remote.userId);
      if (!pc) pc = createPc(remote);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sock = await waitForSocket();
      sock.emit("signal", {
        roomId,
        to: remote.socketId,
        from: sock.id!,
        sdp: pc.localDescription,
      });
    },
    [roomId, userId, createPc]
  );

  const ensurePeer = useCallback(
    async (remote: PeerInfo) => {
      if (!roomId || !userId || !micOnRef.current) return;

      socketToUserRef.current.set(remote.socketId, remote.userId);
      userToSocketRef.current.set(remote.userId, remote.socketId);

      if (!pcsRef.current.has(remote.userId)) {
        createPc(remote);
      }

      if (shouldOffer(userId, remote.userId)) {
        await sendOffer(remote);
      }
    },
    [roomId, userId, createPc, sendOffer]
  );

  const acquireMicrophone = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicPermissionDenied(false);

      for (const [, pc] of pcsRef.current) {
        attachLocalTracks(pc);
      }
      return true;
    } catch (err) {
      console.error(err);
      setMicPermissionDenied(true);
      onPermissionError?.();
      return false;
    }
  }, [attachLocalTracks, onPermissionError]);

  const retryMicrophone = useCallback(async () => {
    return acquireMicrophone();
  }, [acquireMicrophone]);

  const connectToAll = useCallback(async () => {
    if (!userId || !micOnRef.current) return;
    await waitForSocket();
    for (const p of peersRef.current) {
      await ensurePeer(p);
    }
  }, [userId, ensurePeer]);

  useEffect(() => {
    if (!micOn || !roomId || !userId) {
      if (roomId) getSocket().emit("mic-state", { roomId, on: false });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      iceQueueRef.current.clear();
      handlersBoundRef.current = false;
      setRemoteStreams(new Map());
      setRemoteTrackKeys(new Map());
      setConnectedPeers([]);
      setRtcStatus("");
      return;
    }

    let alive = true;
    const socket = getSocket();

    const resolveRemote = (socketId: string): string | undefined => {
      let uid = socketToUserRef.current.get(socketId);
      if (!uid) {
        const p = peersRef.current.find((x) => x.socketId === socketId);
        if (p) {
          uid = p.userId;
          socketToUserRef.current.set(socketId, p.userId);
          userToSocketRef.current.set(p.userId, socketId);
        }
      }
      return uid;
    };

    const queueIce = (uid: string, c: RTCIceCandidateInit) => {
      const q = iceQueueRef.current.get(uid) ?? [];
      q.push(c);
      iceQueueRef.current.set(uid, q);
    };

    const onSignal = async (payload: {
      from: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    }) => {
      const remoteUserId = resolveRemote(payload.from);
      if (!remoteUserId || !userId) return;

      const remote: PeerInfo = {
        userId: remoteUserId,
        socketId: payload.from,
      };

      let pc = pcsRef.current.get(remoteUserId);

      if (payload.sdp?.type === "offer") {
        if (!pc) pc = createPc(remote);

        if (pc.signalingState === "have-local-offer") {
          if (!isPolite(userId, remoteUserId)) {
            return;
          }
          await pc.setLocalDescription({ type: "rollback" });
        }

        await pc.setRemoteDescription(payload.sdp);
        await flushIce(remoteUserId, pc);
        attachLocalTracks(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const sock = await waitForSocket();
        sock.emit("signal", {
          roomId,
          to: payload.from,
          from: sock.id!,
          sdp: pc.localDescription,
        });
        return;
      }

      if (payload.sdp?.type === "answer") {
        if (!pc) return;
        if (pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(payload.sdp);
        await flushIce(remoteUserId, pc);
        return;
      }

      if (payload.candidate) {
        if (!pc) {
          if (!pcsRef.current.has(remoteUserId)) createPc(remote);
          pc = pcsRef.current.get(remoteUserId);
        }
        if (!pc) return;
        if (!pc.remoteDescription) {
          queueIce(remoteUserId, payload.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          queueIce(remoteUserId, payload.candidate);
        }
      }
    };

    const onMicState = ({
      userId: uid,
      socketId,
      on,
    }: {
      userId: string;
      socketId: string;
      on: boolean;
    }) => {
      if (uid === userId || !on || !micOnRef.current) return;
      void ensurePeer({ userId: uid, socketId });
    };

    const onJoined = ({ userId: uid, socketId }: PeerInfo) => {
      if (uid === userId || !micOnRef.current) return;
      void ensurePeer({ userId: uid, socketId });
    };

    const onLeft = ({ userId: uid }: { userId: string }) => {
      removePeer(uid);
      userToSocketRef.current.delete(uid);
    };

    if (!handlersBoundRef.current) {
      socket.on("signal", onSignal);
      socket.on("mic-state", onMicState);
      socket.on("user-joined", onJoined);
      socket.on("user-left", onLeft);
      handlersBoundRef.current = true;
    }

    (async () => {
      await waitForSocket();
      const ok = await acquireMicrophone();
      if (!alive) {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        return;
      }
      if (!ok) return;

      socket.emit("mic-state", { roomId, on: true });
      await connectToAll();
      setRtcStatus("마이크 연결됨 — 상대방도 마이크 ON 필요");
    })();

    return () => {
      alive = false;
      socket.emit("mic-state", { roomId, on: false });
      socket.off("signal", onSignal);
      socket.off("mic-state", onMicState);
      socket.off("user-joined", onJoined);
      socket.off("user-left", onLeft);
      handlersBoundRef.current = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      iceQueueRef.current.clear();
      setRemoteStreams(new Map());
      setRemoteTrackKeys(new Map());
      setConnectedPeers([]);
    };
  }, [
    micOn,
    roomId,
    userId,
    createPc,
    ensurePeer,
    removePeer,
    connectToAll,
    flushIce,
    attachLocalTracks,
    acquireMicrophone,
  ]);

  useEffect(() => {
    if (!micOn || !userId) return;
    void (async () => {
      await waitForSocket();
      for (const p of peers) {
        if (!pcsRef.current.has(p.userId)) {
          await ensurePeer(p);
        }
      }
    })();
  }, [peers, micOn, userId, ensurePeer]);

  return {
    localStream,
    remoteStreams,
    remoteTrackKeys,
    connectedPeers,
    rtcStatus,
    micOn,
    micPermissionDenied,
    retryMicrophone,
  };
}
