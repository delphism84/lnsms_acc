import { useRef } from 'react';
import SerialPortSettingsPanel from './SerialPortSettingsPanel';
import '../styles/Modal.css';
import '../styles/SerialPortModal.css';

export type { SerialPortEntry } from './SerialPortSettingsPanel';

interface SerialPortModalProps {
  onClose: () => void;
}

/** 기존과 동일: 전체 화면 오버레이 모달 */
function SerialPortModal({ onClose }: SerialPortModalProps) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) dragStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) onClose();
      dragStartRef.current = null;
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content modal-content--wide serial-port-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>시리얼 포트 설정</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <SerialPortSettingsPanel variant="modal" onClose={onClose} />
      </div>
    </div>
  );
}

export default SerialPortModal;
