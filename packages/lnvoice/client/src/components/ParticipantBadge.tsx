import styles from "./ParticipantBadge.module.css";

type Props = {
  userId: string;
  isSelf?: boolean;
  micOn: boolean;
  speakerOn: boolean;
};

export function ParticipantBadge({
  userId,
  isSelf,
  micOn,
  speakerOn,
}: Props) {
  const label = isSelf ? `${userId} (나)` : userId;

  return (
    <div className={styles.badge}>
      <span className={styles.name}>{label}</span>
      <span className={micOn ? styles.micOn : styles.micOff}>
        🎤 {micOn ? "ON" : "OFF"}
      </span>
      <span className={speakerOn ? styles.spkOn : styles.spkOff}>
        🔊 {speakerOn ? "ON" : "OFF"}
      </span>
    </div>
  );
}
