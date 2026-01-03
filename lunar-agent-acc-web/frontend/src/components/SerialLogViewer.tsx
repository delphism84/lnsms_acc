import { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../services/api';
import '../styles/SerialLogViewer.css';

interface SerialLogViewerProps {
  onClose: () => void;
}

function SerialLogViewer({ onClose }: SerialLogViewerProps) {
  const [logLines, setLogLines] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lastLineRef = useRef<string>('');

  useEffect(() => {
    // 초기 로그 로드
    loadLatestLog();

    // 1초마다 마지막 라인만 읽기
    const interval = setInterval(() => {
      loadLatestLog();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // 새 로그가 추가되면 스크롤을 맨 아래로
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logLines]);

  const loadLatestLog = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/log/latest`);
      if (response.ok) {
        const data = await response.json();
        if (data.line && data.line !== lastLineRef.current) {
          // 새로운 라인이 있으면 추가
          setLogLines(prev => {
            const newLines = [...prev, data.line];
            // 최대 1000줄까지만 유지
            if (newLines.length > 1000) {
              return newLines.slice(-1000);
            }
            return newLines;
          });
          lastLineRef.current = data.line;
        }
      }
    } catch (error) {
      console.error('로그 로드 실패:', error);
    }
  };

  const handleClear = () => {
    setLogLines([]);
    lastLineRef.current = '';
  };

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
    <div className="log-viewer-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="log-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="log-viewer-header">
          <h2>시리얼 포트 로그</h2>
          <div className="log-viewer-actions">
            <button className="log-clear-button" onClick={handleClear}>
              지우기
            </button>
            <button className="log-close-button" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>

        <div className="log-viewer-content" ref={logContainerRef}>
            {logLines.length === 0 ? (
            <div className="log-empty">로그가 없습니다.</div>
          ) : (
            logLines.map((line, index) => {
              const isTx = line.includes('TX:');
              const isRx = line.includes('RX:');
              const className = isTx ? 'log-line log-tx' : isRx ? 'log-line log-rx' : 'log-line';
              return (
                <div key={index} className={className}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default SerialLogViewer;

