import styles from "./VolumeMeter.module.css";

type Props = {
  label: string;
  level: number;
  icon?: string;
  compact?: boolean;
};

export function VolumeMeter({ label, level, icon = "🔊", compact }: Props) {
  return (
    <div
      className={compact ? `${styles.wrap} ${styles.compact}` : styles.wrap}
    >
      <span className={styles.label}>
        {icon} {label}
      </span>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${Math.max(2, level)}%` }}
        />
      </div>
      <span className={styles.pct}>{level}%</span>
    </div>
  );
}
