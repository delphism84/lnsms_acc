import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./AppBar.module.css";

export function AppBar() {
  const { userId, logout } = useAuth();

  return (
    <header className={styles.bar}>
      <Link to="/lobby" className={styles.logo}>
        lnvoice
      </Link>
      <div className={styles.right}>
        {userId && <span className={styles.userId}>{userId}</span>}
        {userId && (
          <button type="button" className={styles.logout} onClick={logout}>
            로그아웃
          </button>
        )}
      </div>
    </header>
  );
}
