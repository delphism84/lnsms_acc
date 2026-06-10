import { useEffect, useRef } from "react";

type Props = {
  userId: string;
  stream: MediaStream;
  trackKey: string;
};

/** 원격 WebRTC 오디오 재생 — 트랙 추가 시 srcObject 갱신 */
export function RemoteAudio({ userId, stream, trackKey }: Props) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tracks = stream.getAudioTracks().filter((t) => t.readyState === "live");
    if (tracks.length === 0) {
      el.srcObject = null;
      return;
    }

    const playStream = new MediaStream(tracks);
    el.srcObject = playStream;
    el.muted = false;
    el.volume = 1;

    const play = () => {
      void el.play().catch((err) => {
        console.warn("[RemoteAudio] play failed", userId, err);
      });
    };
    play();

    const onUnmute = () => play();
    tracks.forEach((t) => t.addEventListener("unmute", onUnmute));

    return () => {
      tracks.forEach((t) => t.removeEventListener("unmute", onUnmute));
      el.pause();
      el.srcObject = null;
    };
  }, [stream, trackKey, userId]);

  return (
    <audio
      ref={ref}
      autoPlay
      playsInline
      data-remote={userId}
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
