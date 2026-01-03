import { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../services/api';
import { showCustomAlert } from './CustomAlert';
import SerialLogViewer from './SerialLogViewer';
import '../styles/Modal.css';

interface SerialPortModalProps {
  onClose: () => void;
}

interface SerialSettings {
  portName: string;
  baudRate: number;
  autoConnect: boolean;
}

function SerialPortModal({ onClose }: SerialPortModalProps) {
  const [settings, setSettings] = useState<SerialSettings>({
    portName: 'COM1',
    baudRate: 9600,
    autoConnect: true
  });
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  useEffect(() => {
    loadSettings();
    loadAvailablePorts();
    checkConnectionStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    }
  };

  const loadAvailablePorts = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/ports`);
      if (response.ok) {
        const data = await response.json();
        setAvailablePorts(data);
      }
    } catch (error) {
      console.error('포트 목록 로드 실패:', error);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/status`);
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data);
      }
    } catch (error) {
      console.error('연결 상태 확인 실패:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setShowPendingModal(true);
    setPendingMessage('설정 저장 중...');
    
    try {
      const apiUrl = await getApiBaseUrl();
      
      // 설정 저장 (백엔드에서 자동으로 disconnect -> connect 수행)
      const saveResponse = await fetch(`${apiUrl}/api/serialport/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.message || '설정 저장에 실패했습니다.');
      }

      // 연결 해제 중 표시
      if (isConnected) {
        setPendingMessage('시리얼 포트 연결 해제 중...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 재연결 중 표시 (자동 연결이 활성화된 경우)
      if (settings.autoConnect) {
        setPendingMessage('시리얼 포트 연결 중...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 연결 대기
      }

      // 연결 상태 확인
      setPendingMessage('연결 상태 확인 중...');
      await checkConnectionStatus();
      await new Promise(resolve => setTimeout(resolve, 300));

      // 완료 모달 표시
      setShowPendingModal(false);
      setShowSuccessModal(true);
      
      setTimeout(() => {
        setShowSuccessModal(false);
        onClose();
      }, 2000); // 2초 후 자동 닫기

    } catch (error) {
      console.error('설정 저장 실패:', error);
      setShowPendingModal(false);
      await showCustomAlert(error instanceof Error ? error.message : '설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          portName: settings.portName,
          baudRate: settings.baudRate
        })
      });

      if (response.ok) {
        await checkConnectionStatus();
      }
    } catch (error) {
      console.error('연결 실패:', error);
      await showCustomAlert('연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      await fetch(`${apiUrl}/api/serialport/disconnect`, {
        method: 'POST'
      });
      await checkConnectionStatus();
    } catch (error) {
      console.error('연결 해제 실패:', error);
    } finally {
      setLoading(false);
    }
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
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>시리얼 포트 설정</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-form">
          <div className="form-group">
            <label>포트 이름</label>
            <select
              value={settings.portName}
              onChange={(e) => setSettings({ ...settings, portName: e.target.value })}
            >
              {availablePorts.map(port => (
                <option key={port} value={port}>{port}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>전송 속도 (Baud Rate)</label>
            <select
              value={settings.baudRate}
              onChange={(e) => setSettings({ ...settings, baudRate: parseInt(e.target.value) })}
            >
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.autoConnect}
                onChange={(e) => setSettings({ ...settings, autoConnect: e.target.checked })}
              />
              자동 연결
            </label>
          </div>

          <div className="connection-status-display">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '✓ 연결됨' : '✗ 연결 안 됨'}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="log-button"
              onClick={() => setShowPasswordDialog(true)}
            >
              로그
            </button>
            {isConnected ? (
              <button
                type="button"
                className="disconnect-button"
                onClick={handleDisconnect}
                disabled={loading}
              >
                연결 해제
              </button>
            ) : (
              <button
                type="button"
                className="connect-button"
                onClick={handleConnect}
                disabled={loading}
              >
                연결
              </button>
            )}
            <button type="button" className="cancel-button" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="save-button"
              onClick={handleSave}
              disabled={loading}
            >
              저장
            </button>
          </div>
        </div>
      </div>

      {showPasswordDialog && (
        <div className="password-dialog-overlay" onClick={() => setShowPasswordDialog(false)}>
          <div className="password-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>비밀번호 입력</h3>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
              placeholder="비밀번호를 입력하세요"
              autoFocus
            />
            <div className="password-dialog-actions">
              <button onClick={() => {
                setShowPasswordDialog(false);
                setPassword('');
              }}>
                취소
              </button>
              <button onClick={handlePasswordSubmit}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogViewer && (
        <SerialLogViewer onClose={() => setShowLogViewer(false)} />
      )}

      {showPendingModal && (
        <div className="pending-modal-overlay">
          <div className="pending-modal">
            <div className="pending-spinner"></div>
            <div className="pending-message">{pendingMessage}</div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="success-icon">✓</div>
            <div className="success-message">설정이 저장되었습니다.</div>
          </div>
        </div>
      )}
    </div>
  );

  async function handlePasswordSubmit() {
    if (password === '8206') {
      setShowPasswordDialog(false);
      setPassword('');
      setShowLogViewer(true);
    } else {
      await showCustomAlert('비밀번호가 올바르지 않습니다.');
      setPassword('');
    }
  }
}

export default SerialPortModal;

