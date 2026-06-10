import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { userId } = useAuth();
  if (!userId) return <Navigate to="/login" replace />;

  return (
    <div className={styles.wrap}>
      <h2>설정</h2>
      <p>준비 중입니다.</p>
    </div>
  );
}
