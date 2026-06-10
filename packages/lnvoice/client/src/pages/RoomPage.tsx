import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ParticipantBadge } from "../components/ParticipantBadge";
import { RemoteAudio } from "../components/RemoteAudio";
import { VolumeMeter } from "../components/VolumeMeter";
import { useAudioLevel } from "../hooks/useAudioLevel";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useWebRTC } from "../hooks/useWebRTC";
import styles from "./RoomPage.module.css";

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { userId } = useAuth();
  const [micOn, setMicOn] = useState(false);
  const [text, setText] = useState("");
  const [showPermBanner, setShowPermBanner] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const handlePermissionError = useCallback(() => {
    setMicOn(false);
    setShowPermBanner(true);
  }, []);

  const { messages, peers, allPeers, sendMessage } = useRoomSocket(
    roomId ?? null,
    userId
  );
  const {
    localStream,
    remoteStreams,
    remoteTrackKeys,
    connectedPeers,
    micPermissionDenied,
    retryMicrophone,
  } = useWebRTC(
    roomId ?? null,
    userId,
    micOn,
    peers,
    handlePermissionError
  );

  const micLevel = useAudioLevel(localStream, micOn);

  const remoteEntries = useMemo(
    () => [...remoteStreams.entries()],
    [remoteStreams]
  );

  const meterRows = remoteEntries.length === 0 ? 2 : 1 + remoteEntries.length;

  const participants = useMemo(() => {
    const list: {
      userId: string;
      isSelf: boolean;
      micOn: boolean;
      speakerOn: boolean;
    }[] = [];

    if (userId) {
      list.push({
        userId,
        isSelf: true,
        micOn,
        speakerOn: remoteEntries.length > 0,
      });
    }

    for (const p of allPeers) {
      if (p.userId === userId) continue;
      list.push({
        userId: p.userId,
        isSelf: false,
        micOn: Boolean(p.micOn),
        speakerOn:
          connectedPeers.includes(p.userId) ||
          remoteStreams.has(p.userId),
      });
    }

    return list;
  }, [allPeers, userId, micOn, connectedPeers, remoteStreams, remoteEntries]);

  useEffect(() => {
    if (roomId) sessionStorage.setItem("lnvoice_currentRoomId", roomId);
  }, [roomId]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (micPermissionDenied) setShowPermBanner(true);
  }, [micPermissionDenied]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (status.state === "denied") setShowPermBanner(true);
        if (status.state === "granted") setShowPermBanner(false);
        status.onchange = () => {
          if (status.state === "denied") setShowPermBanner(true);
          if (status.state === "granted") setShowPermBanner(false);
        };
      })
      .catch(() => {});
  }, []);

  const onPermissionBannerClick = async () => {
    const ok = await retryMicrophone();
    if (ok) {
      setShowPermBanner(false);
      setMicOn(true);
    }
  };

  const toggleMic = () => {
    if (micOn) {
      setMicOn(false);
      return;
    }
    setMicOn(true);
  };

  if (!userId) return <Navigate to="/login" replace />;
  if (!roomId) return <Navigate to="/lobby" replace />;

  const onSend = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    sendMessage(t);
    setText("");
  };

  return (
    <div className={styles.page}>
      {showPermBanner && (
        <button
          type="button"
          className={styles.permissionBanner}
          onClick={onPermissionBannerClick}
        >
          권한 오류 — 마이크 허용이 필요합니다. 탭하여 다시 요청
        </button>
      )}

      {remoteEntries.map(([uid, stream]) => (
        <RemoteAudio
          key={uid}
          userId={uid}
          stream={stream}
          trackKey={remoteTrackKeys.get(uid) ?? ""}
        />
      ))}

      <div
        className={
          showPermBanner ? styles.participantsWithBanner : styles.participants
        }
      >
        {participants.map((p) => (
          <ParticipantBadge
            key={p.userId}
            userId={p.userId}
            isSelf={p.isSelf}
            micOn={p.micOn}
            speakerOn={p.speakerOn}
          />
        ))}
        {participants.length === 0 && (
          <span className={styles.emptyPeers}>참석자 없음</span>
        )}
      </div>

      <div className={showPermBanner ? styles.bodyWithBanner : styles.body}>
        <div className={styles.chatPane}>
          <div className={styles.messages} ref={listRef}>
            {messages.map((m, i) => (
              <div
                key={m.id ?? `${m.createdAt}-${i}`}
                className={m.kind === "system" ? styles.system : styles.msg}
              >
                {m.kind === "system" ? (
                  m.text
                ) : (
                  <>
                    <strong>{m.userId}</strong>: {m.text}
                  </>
                )}
              </div>
            ))}
          </div>
          <form className={styles.chatForm} onSubmit={onSend}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메시지"
            />
            <button type="submit">전송</button>
          </form>
        </div>
      </div>

      <footer
        className={styles.toolBar}
        style={{ minHeight: `${meterRows * 34 + 8}px` }}
      >
        <div
          className={styles.meters}
          style={{ minHeight: `${meterRows * 34}px` }}
        >
          <VolumeMeter
            label="마이크"
            level={micOn ? micLevel : 0}
            icon="🎤"
            compact
          />
          {remoteEntries.length === 0 ? (
            <VolumeMeter label="스피커" level={0} icon="🔊" compact />
          ) : (
            remoteEntries.map(([uid, stream]) => (
              <RemoteSpeakerMeter key={uid} userId={uid} stream={stream} />
            ))
          )}
        </div>
        <button
          type="button"
          className={micOn ? styles.micOn : styles.micOff}
          onClick={toggleMic}
          aria-pressed={micOn}
          title={micOn ? "마이크 끄기" : "마이크 켜기"}
        >
          <span className={styles.micIcon}>🎤</span>
          <span className={styles.micLabel}>{micOn ? "ON" : "OFF"}</span>
        </button>
      </footer>
    </div>
  );
}

function RemoteSpeakerMeter({
  userId,
  stream,
}: {
  userId: string;
  stream: MediaStream;
}) {
  const trackKey = stream
    .getAudioTracks()
    .map((t) => `${t.id}:${t.readyState}`)
    .join(",");
  const level = useAudioLevel(
    stream,
    stream.getAudioTracks().length > 0,
    trackKey
  );
  const shortId = userId.length > 8 ? `${userId.slice(0, 8)}…` : userId;
  return (
    <VolumeMeter label={shortId} level={level} icon="🔊" compact />
  );
}
