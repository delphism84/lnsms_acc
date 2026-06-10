import { useEffect, useRef, useState } from "react";

/** MediaStream 오디오 레벨 0~100 (RMS) */
export function useAudioLevel(
  stream: MediaStream | null,
  active: boolean,
  /** 트랙 추가 시 effect 재시작용 */
  trackKey = ""
) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !stream) {
      setLevel(0);
      return;
    }

    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) {
      setLevel(0);
      return;
    }

    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    try {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch {
      return;
    }

    const data = new Uint8Array(analyser!.frequencyBinCount);

    const tick = () => {
      analyser!.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(100, Math.round(rms * 280)));
      rafRef.current = requestAnimationFrame(tick);
    };

    void ctx.resume();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source?.disconnect();
      void ctx?.close();
      setLevel(0);
    };
  }, [stream, active, trackKey]);

  return level;
}
