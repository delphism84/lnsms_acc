import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { userId, login } = useAuth();
  const navigate = useNavigate();
  const [id, setId] = useState("");

  if (userId) return <Navigate to="/lobby" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = id.trim();
    if (trimmed.length < 2) {
      alert("ID는 2자 이상 입력하세요.");
      return;
    }
    login(trimmed);
    navigate("/lobby");
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1>lnvoice 로그인</h1>
        <p className={styles.hint}>ID만 입력하세요 (비밀번호 없음)</p>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="사용자 ID"
          maxLength={20}
          autoFocus
        />
        <button type="submit">입장</button>
      </form>
    </div>
  );
}
