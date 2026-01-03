import { useEffect, useState } from 'react';
import '../styles/CustomAlert.css';

interface AlertQueueItem {
  message: string;
  resolve: () => void;
}

let alertQueue: AlertQueueItem[] = [];
let setAlertState: ((item: AlertQueueItem | null) => void) | null = null;

export function showCustomAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const item: AlertQueueItem = { message, resolve };
    alertQueue.push(item);
    if (setAlertState) {
      setAlertState(alertQueue[0]);
    }
  });
}

export function CustomAlertProvider() {
  const [currentAlert, setCurrentAlert] = useState<AlertQueueItem | null>(null);

  useEffect(() => {
    setAlertState = setCurrentAlert;
    // 큐에 있는 첫 번째 알림 표시
    if (alertQueue.length > 0) {
      setCurrentAlert(alertQueue[0]);
    }
  }, []);

  const handleConfirm = () => {
    if (currentAlert) {
      currentAlert.resolve();
      alertQueue.shift();
      // 다음 알림이 있으면 표시
      if (alertQueue.length > 0) {
        setCurrentAlert(alertQueue[0]);
      } else {
        setCurrentAlert(null);
      }
    }
  };

  if (!currentAlert) {
    return null;
  }

  return (
    <div className="custom-alert-overlay">
      <div className="custom-alert-container">
        <div className="custom-alert-content">
          <div className="custom-alert-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="custom-alert-message">{currentAlert.message}</div>
        </div>
        <div className="custom-alert-footer">
          <button className="custom-alert-button" onClick={handleConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

