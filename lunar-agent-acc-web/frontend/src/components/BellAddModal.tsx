import { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../services/api';
import '../styles/Modal.css';

interface BellAddModalProps {
  onAdd: (bellCode: string) => void;
  onClose: () => void;
}

function BellAddModal({ onAdd, onClose }: BellAddModalProps) {
  const [status, setStatus] = useState<'listening' | 'done'>('listening');
  const detectedSetRef = useRef<Set<string>>(new Set());
  const closeTimerRef = useRef<number | null>(null);

  // 모달이 열릴 때 백엔드에 상태 전달
  useEffect(() => {
    const setModalState = async () => {
      try {
        const apiUrl = await getApiBaseUrl();
        await fetch(`${apiUrl}/api/window/set-bell-add-modal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isOpen: true }),
        });
      } catch (error) {
        console.error('벨 등록 모달 상태 설정 실패:', error);
      }
    };
    setModalState();

    // 모달이 닫힐 때 백엔드에 상태 전달
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      const setModalStateClosed = async () => {
        try {
          const apiUrl = await getApiBaseUrl();
          await fetch(`${apiUrl}/api/window/set-bell-add-modal`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isOpen: false }),
          });
        } catch (error) {
          console.error('벨 등록 모달 상태 설정 실패:', error);
        }
      };
      setModalStateClosed();
    };
  }, []);

  useEffect(() => {
    if (status !== 'listening') return;

    // 벨 코드 감지를 위한 폴링
    const checkBellCode = async () => {
      try {
        const apiUrl = await getApiBaseUrl();
        const response = await fetch(`${apiUrl}/api/bell/detect`);
        if (response.ok) {
          const data = await response.json();
          if (data.bellCode) {
            // 벨 코드 정규화 (대소문자 무시 비교)
            const normalizedCode = data.bellCode.toLowerCase().trim();
            if (detectedSetRef.current.has(normalizedCode)) return;

            detectedSetRef.current.add(normalizedCode);
            // 벨 코드를 즉시 추가
            onAdd(data.bellCode);

            // 벨 코드는 표시하지 않고, 완료 문구만 2초 보여준 뒤 자동 닫기
            setStatus('done');
            closeTimerRef.current = window.setTimeout(() => {
              onClose();
            }, 2000);
          }
        }
      } catch (error) {
        console.error('벨 코드 확인 실패:', error);
      }
    };

    const interval = setInterval(checkBellCode, 500); // 0.5초마다 확인
    return () => clearInterval(interval);
  }, [status, onAdd, onClose]);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 드래그 시작 위치 저장
    if (e.target === e.currentTarget) {
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 오버레이 자체를 클릭했을 때만 닫기 (모달 컨텐츠 클릭/드래그는 무시)
    if (e.target === e.currentTarget && dragStartRef.current) {
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartRef.current.x, 2) + 
        Math.pow(e.clientY - dragStartRef.current.y, 2)
      );
      // 드래그 거리가 5px 미만일 때만 클릭으로 간주하고 닫기
      if (dragDistance < 5) {
        onClose();
      }
      dragStartRef.current = null;
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content bell-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>벨 등록</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-form">
          <div className="bell-detection-area">
            <div className="bell-instruction">
              {status === 'listening' ? (
                <>
                  <div className="bell-listening-indicator">
                    <div className="pulse-animation"></div>
                    <span>벨을 누르세요</span>
                  </div>
                </>
              ) : (
                <div className="bell-registered-row">벨 등록 완료</div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BellAddModal;

