import { useEffect, useState } from 'react';
import '../styles/CustomConfirm.css';

interface ConfirmQueueItem {
  message: string;
  resolve: (result: boolean) => void;
}

let confirmQueue: ConfirmQueueItem[] = [];
let setConfirmState: ((item: ConfirmQueueItem | null) => void) | null = null;

export function showCustomConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const item: ConfirmQueueItem = { message, resolve };
    confirmQueue.push(item);
    if (setConfirmState) {
      setConfirmState(confirmQueue[0]);
    }
  });
}

export function CustomConfirmProvider() {
  const [currentConfirm, setCurrentConfirm] = useState<ConfirmQueueItem | null>(null);

  useEffect(() => {
    setConfirmState = setCurrentConfirm;
    // 큐에 있는 첫 번째 확인 표시
    if (confirmQueue.length > 0) {
      setCurrentConfirm(confirmQueue[0]);
    }
    return () => {
      // Provider 언마운트 시 전역 setter 해제
      if (setConfirmState === setCurrentConfirm) {
        setConfirmState = null;
      }
    };
  }, []);

  const handleConfirm = () => {
    const item = currentConfirm;
    if (!item) return;
    // 먼저 큐/상태를 정리해서 UI가 즉시 닫히도록 보장
    confirmQueue.shift();
    setCurrentConfirm(confirmQueue[0] ?? null);
    item.resolve(true);
  };

  const handleCancel = () => {
    const item = currentConfirm;
    if (!item) return;
    // 먼저 큐/상태를 정리해서 UI가 즉시 닫히도록 보장
    confirmQueue.shift();
    setCurrentConfirm(confirmQueue[0] ?? null);
    item.resolve(false);
  };

  if (!currentConfirm) {
    return null;
  }

  return (
    <div className="custom-confirm-overlay">
      <div className="custom-confirm-container">
        <div className="custom-confirm-content">
          <div className="custom-confirm-message">{currentConfirm.message}</div>
        </div>
        <div className="custom-confirm-footer">
          <button className="custom-confirm-button confirm-button" onClick={handleConfirm}>
            확인
          </button>
          <button className="custom-confirm-button cancel-button" onClick={handleCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

