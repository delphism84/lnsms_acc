import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createRoom, fetchRooms, type RoomSummary } from "../lib/api";
import styles from "./LobbyPage.module.css";

export function LobbyPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [roomName, setRoomName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRooms(await fetchRooms());
    } catch {
      alert("방 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!userId) return <Navigate to="/login" replace />;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = roomName.trim();
    if (!name) return;
    try {
      await createRoom(name);
      setRoomName("");
      setModalOpen(false);
      await load();
    } catch {
      alert("방 생성에 실패했습니다.");
    }
  };

  const enterRoom = (id: string) => {
    sessionStorage.setItem("lnvoice_currentRoomId", id);
    navigate(`/room/${id}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>대화방 로비</h2>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setModalOpen(true)}
        >
          + 방 추가
        </button>
      </div>

      {loading && <p className={styles.muted}>불러오는 중…</p>}
      <div className={styles.grid}>
        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            className={styles.card}
            onClick={() => enterRoom(room.id)}
          >
            <span className={styles.roomName}>{room.name}</span>
            <span className={styles.meta}>최대 {room.maxParticipants}명</span>
          </button>
        ))}
      </div>

      {modalOpen && (
        <div
          className={styles.overlay}
          onClick={() => setModalOpen(false)}
          role="presentation"
        >
          <form
            className={styles.modal}
            onSubmit={onCreate}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>새 방 만들기</h3>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="방 이름"
              maxLength={64}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setModalOpen(false)}>
                취소
              </button>
              <button type="submit" className={styles.primary}>
                만들기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
