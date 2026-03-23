import { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../services/api';
import { showCustomAlert } from './CustomAlert';
import { showCustomConfirm } from './CustomConfirm';
import SerialLogViewer from './SerialLogViewer';
import '../styles/Modal.css';
import '../styles/SerialPortModal.css';

interface SerialPortModalProps {
  onClose: () => void;
}

export interface SerialPortEntry {
  id: string;
  portName: string;
  baudRate: number;
  autoConnect: boolean;
  secureEnabled?: boolean;
  deviceSerialNumber?: string;
}

interface SerialSettingsDto {
  ports: SerialPortEntry[];
}

interface PortStatusItem {
  portName: string;
  isConnected: boolean;
  baudRate?: number;
  secureEnabled?: boolean;
  currentSerialNumber?: string;
  lastError?: string;
}

function SerialPortModal({ onClose }: SerialPortModalProps) {
  const [ports, setPorts] = useState<SerialPortEntry[]>([]);
  const [statusList, setStatusList] = useState<PortStatusItem[]>([]);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ portName: 'COM1', baudRate: 9600, autoConnect: true });
  const [scanBaudRate, setScanBaudRate] = useState(9600);

  const loadSettings = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/settings`);
      if (response.ok) {
        const data: SerialSettingsDto = await response.json();
        const list = Array.isArray(data.ports) ? data.ports : [];
        setPorts(list.map(p => ({
          id: p.id || `${p.portName}-${Date.now()}`,
          portName: p.portName || 'COM1',
          baudRate: p.baudRate ?? 9600,
          autoConnect: p.autoConnect ?? true,
          secureEnabled: p.secureEnabled,
          deviceSerialNumber: p.deviceSerialNumber
        })));
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
        setAvailablePorts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('포트 목록 로드 실패:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/status`);
      if (response.ok) {
        const data = await response.json();
        setStatusList(Array.isArray(data?.ports) ? data.ports : []);
      }
    } catch (error) {
      console.error('상태 로드 실패:', error);
    }
  };

  useEffect(() => {
    loadSettings();
    loadAvailablePorts();
    loadStatus();
  }, []);

  const isPortConnected = (portName: string) =>
    statusList.some(s => s.portName === portName && s.isConnected);

  const handleSave = async () => {
    setLoading(true);
    setShowPendingModal(true);
    setPendingMessage('설정 저장 중...');
    try {
      const apiUrl = await getApiBaseUrl();
      const payload = { ports: ports.map(p => ({
        id: p.id,
        portName: p.portName,
        baudRate: p.baudRate,
        autoConnect: p.autoConnect,
        secureEnabled: p.secureEnabled ?? false,
        deviceSerialNumber: p.deviceSerialNumber ?? '00000000'
      })) };
      const res = await fetch(`${apiUrl}/api/serialport/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '설정 저장에 실패했습니다.');
      }
      setPendingMessage('연결 상태 확인 중...');
      await loadStatus();
      setShowPendingModal(false);
      setShowSuccessModal(true);
      setTimeout(() => { setShowSuccessModal(false); onClose(); }, 2000);
    } catch (error) {
      setShowPendingModal(false);
      await showCustomAlert(error instanceof Error ? error.message : '설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOnly = async () => {
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      const payload = { ports: ports.map(p => ({
        id: p.id,
        portName: p.portName,
        baudRate: p.baudRate,
        autoConnect: p.autoConnect,
        secureEnabled: p.secureEnabled ?? false,
        deviceSerialNumber: p.deviceSerialNumber ?? '00000000'
      })) };
      const res = await fetch(`${apiUrl}/api/serialport/settings/save-only`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '설정 저장에 실패했습니다.');
      }
      await showCustomAlert('설정이 저장되었습니다.');
      onClose();
    } catch (e: unknown) {
      await showCustomAlert(e instanceof Error ? e.message : '설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoScanAndAdd = async () => {
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/serialport/auto-scan/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baudRate: scanBaudRate, timeoutMs: 400 })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '자동 검색에 실패했습니다.');
      const added = data.added as string[] | undefined;
      const okPorts = data.okPorts as string[] | undefined;
      await loadSettings();
      await loadStatus();
      if (Array.isArray(added) && added.length > 0) {
        await showCustomAlert(`통과한 COM ${added.length}개를 등록했습니다: ${added.join(', ')}`);
      } else if (Array.isArray(okPorts) && okPorts.length > 0) {
        await showCustomAlert(`이미 등록된 포트가 있습니다. 통과 포트: ${okPorts.join(', ')}`);
      } else {
        await showCustomAlert('TX/RX(ok) 통과한 포트가 없습니다.');
      }
    } catch (e: unknown) {
      await showCustomAlert(e instanceof Error ? e.message : '자동 검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (entry: SerialPortEntry) => {
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/serialport/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          portName: entry.portName,
          baudRate: entry.baudRate,
          autoConnect: entry.autoConnect,
          secureEnabled: entry.secureEnabled ?? false,
          deviceSerialNumber: entry.deviceSerialNumber ?? '00000000'
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '연결 실패');
      }
      await loadStatus();
    } catch (e: unknown) {
      await showCustomAlert(e instanceof Error ? e.message : '연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (portName: string) => {
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      await fetch(`${apiUrl}/api/serialport/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portName })
      });
      await loadStatus();
    } catch (e: unknown) {
      await showCustomAlert(e instanceof Error ? e.message : '연결 해제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePort = async (entry: SerialPortEntry) => {
    const ok = await showCustomConfirm(`"${entry.portName}"을(를) 목록에서 제거할까요?`);
    if (!ok) return;
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/serialport/ports/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portName: entry.portName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '제거 실패');
      }
      await loadSettings();
      await loadStatus();
    } catch (e: unknown) {
      await showCustomAlert(e instanceof Error ? e.message : '제거에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPort = async () => {
    if (!addForm.portName?.trim()) {
      await showCustomAlert('포트를 선택하세요.');
      return;
    }
    setLoading(true);
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/serialport/ports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portName: addForm.portName,
          baudRate: addForm.baudRate,
          autoConnect: addForm.autoConnect,
          secureEnabled: false,
          deviceSerialNumber: '00000000'
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '추가 실패');
      }
      setShowAddModal(false);
      await loadSettings();
    } catch (e: unknown) {
      await showCustomAlert(e instanceof Error ? e.message : 'COM 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="modal-content modal-content--wide serial-port-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>시리얼 포트 설정</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="serial-port-modal-body">
          <div className="serial-port-toolbar">
            <div className="form-inline">
              <label>검색 Baud</label>
              <select value={scanBaudRate} onChange={e => setScanBaudRate(Number(e.target.value))}>
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>
            </div>
            <button type="button" className="connect-button" onClick={handleAutoScanAndAdd} disabled={loading}>
              자동 검색 후 통과 COM 모두 추가
            </button>
            <button type="button" className="save-button" onClick={() => setShowAddModal(true)} disabled={loading}>
              수동 COM 추가
            </button>
            <button type="button" className="log-button" onClick={() => setShowPasswordDialog(true)}>로그</button>
          </div>

          <div className="serial-port-list">
            <div className="serial-port-list-header">
              <span>등록된 COM</span>
              <span>Baud</span>
              <span>상태</span>
              <span>동작</span>
            </div>
            {ports.length === 0 ? (
              <div className="serial-port-list-empty">등록된 포트가 없습니다. 자동 검색 또는 수동 추가를 이용하세요.</div>
            ) : (
              ports.map(entry => {
                const connected = isPortConnected(entry.portName);
                return (
                  <div key={entry.id} className="serial-port-row">
                    <span className="port-name">{entry.portName}</span>
                    <span className="port-baud">{entry.baudRate}</span>
                    <span className={`port-status ${connected ? 'connected' : 'disconnected'}`}>
                      {connected ? '✓ 연결됨' : '✗ 해제'}
                    </span>
                    <span className="port-actions">
                      {connected ? (
                        <button type="button" className="disconnect-button small" onClick={() => handleDisconnect(entry.portName)} disabled={loading}>해제</button>
                      ) : (
                        <button type="button" className="connect-button small" onClick={() => handleConnect(entry)} disabled={loading}>연결</button>
                      )}
                      <button type="button" className="remove-button small" onClick={() => handleRemovePort(entry)} disabled={loading}>삭제</button>
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="serial-port-modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>취소</button>
            <button type="button" className="save-button" onClick={handleSaveOnly} disabled={loading}>저장만</button>
            <button type="button" className="save-button primary" onClick={handleSave} disabled={loading}>저장 후 자동연결 포트 연결</button>
          </div>
        </div>
      </div>

      {showPasswordDialog && (
        <div className="password-dialog-overlay" onClick={() => setShowPasswordDialog(false)}>
          <div className="password-dialog" onClick={e => e.stopPropagation()}>
            <h3>비밀번호 입력</h3>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyPress={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              placeholder="비밀번호를 입력하세요"
              autoFocus
            />
            <div className="password-dialog-actions">
              <button onClick={() => { setShowPasswordDialog(false); setPassword(''); }}>취소</button>
              <button onClick={handlePasswordSubmit}>확인</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay serial-add-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content serial-add-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>수동 COM 추가</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>포트 이름</label>
                <select
                  value={addForm.portName}
                  onChange={e => setAddForm(f => ({ ...f, portName: e.target.value }))}
                >
                  {availablePorts.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  {availablePorts.length === 0 && <option value="COM1">COM1</option>}
                </select>
              </div>
              <div className="form-group">
                <label>전송 속도 (Baud)</label>
                <select value={addForm.baudRate} onChange={e => setAddForm(f => ({ ...f, baudRate: Number(e.target.value) }))}>
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={addForm.autoConnect} onChange={e => setAddForm(f => ({ ...f, autoConnect: e.target.checked }))} />
                  자동 연결
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowAddModal(false)}>취소</button>
                <button type="button" className="save-button" onClick={handleAddPort} disabled={loading}>추가</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogViewer && <SerialLogViewer onClose={() => setShowLogViewer(false)} />}
      {showPendingModal && (
        <div className="pending-modal-overlay">
          <div className="pending-modal">
            <div className="pending-spinner" />
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
