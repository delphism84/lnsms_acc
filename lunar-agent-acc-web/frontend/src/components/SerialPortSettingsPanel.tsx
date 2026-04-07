import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../services/api';
import { showCustomAlert } from './CustomAlert';
import { showCustomConfirm } from './CustomConfirm';
import SerialLogViewer from './SerialLogViewer';
import '../styles/Modal.css';
import '../styles/SerialPortModal.css';

export type SerialPortSettingsVariant = 'modal' | 'page';

export interface SerialPortSettingsPanelProps {
  variant: SerialPortSettingsVariant;
  /** variant가 modal일 때 저장/취소로 닫기 */
  onClose?: () => void;
}

export interface SerialPortEntry {
  id: string;
  portName: string;
  baudRate: number;
  autoConnect: boolean;
  secureEnabled?: boolean;
  allowLegacyBellDecrypt?: boolean;
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

type PortFormState = {
  id?: string;
  portName: string;
  baudRate: number;
  autoConnect: boolean;
  secureEnabled: boolean;
  deviceSerialNumber: string;
};

function SerialPortSettingsPanel({ variant, onClose }: SerialPortSettingsPanelProps) {
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
  const [systemAccessPassword, setSystemAccessPassword] = useState('8206');
  /** app.json 시리얼 암호화 마스터. false면 런타임에서 포트별 보안이 적용되지 않음 */
  const [serialEncryptionMaster, setSerialEncryptionMaster] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPortId, setEditingPortId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<PortFormState>({
    portName: 'COM1',
    baudRate: 9600,
    autoConnect: true,
    secureEnabled: false,
    deviceSerialNumber: '00000000',
  });
  const [scanBaudRate, setScanBaudRate] = useState(9600);

  const loadSettings = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/serialport/settings`);
      if (response.ok) {
        const data: SerialSettingsDto = await response.json();
        const list = Array.isArray(data.ports) ? data.ports : [];
        setPorts(
          list.map((p) => ({
            id: p.id || `${p.portName}-${Date.now()}`,
            portName: p.portName || 'COM1',
            baudRate: p.baudRate ?? 9600,
            autoConnect: p.autoConnect ?? true,
            secureEnabled: p.secureEnabled,
            allowLegacyBellDecrypt: true,
            deviceSerialNumber: p.deviceSerialNumber,
          })),
        );
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
    void (async () => {
      try {
        const apiUrl = await getApiBaseUrl();
        const r = await fetch(`${apiUrl}/api/settings/app`, { signal: AbortSignal.timeout(1000) });
        if (!r.ok) return;
        const cfg = await r.json().catch(() => ({}));
        if (typeof cfg?.systemAccessPassword === 'string' && cfg.systemAccessPassword.trim()) {
          setSystemAccessPassword(cfg.systemAccessPassword.trim());
        }
        setSerialEncryptionMaster(Boolean(cfg?.serialEncryptionEnabled));
      } catch {
        // ignore
      }
    })();
  }, []);

  const isPortConnected = (portName: string) => statusList.some((s) => s.portName === portName && s.isConnected);

  const handleSave = async () => {
    setLoading(true);
    setShowPendingModal(true);
    setPendingMessage('설정 저장 중...');
    try {
      const apiUrl = await getApiBaseUrl();
      const payload = {
        ports: ports.map((p) => ({
          id: p.id,
          portName: p.portName,
          baudRate: p.baudRate,
          autoConnect: p.autoConnect,
          secureEnabled: p.secureEnabled ?? false,
          allowLegacyBellDecrypt: true,
          deviceSerialNumber: p.deviceSerialNumber ?? '00000000',
        })),
      };
      const res = await fetch(`${apiUrl}/api/serialport/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '설정 저장에 실패했습니다.');
      }
      setPendingMessage('연결 상태 확인 중...');
      await loadStatus();
      setShowPendingModal(false);
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        if (variant === 'modal') onClose?.();
      }, 2000);
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
      const payload = {
        ports: ports.map((p) => ({
          id: p.id,
          portName: p.portName,
          baudRate: p.baudRate,
          autoConnect: p.autoConnect,
          secureEnabled: p.secureEnabled ?? false,
          allowLegacyBellDecrypt: true,
          deviceSerialNumber: p.deviceSerialNumber ?? '00000000',
        })),
      };
      const res = await fetch(`${apiUrl}/api/serialport/settings/save-only`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '설정 저장에 실패했습니다.');
      }
      await showCustomAlert('설정이 저장되었습니다.');
      if (variant === 'modal') onClose?.();
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
        body: JSON.stringify({ baudRate: scanBaudRate, timeoutMs: 400 }),
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
          allowLegacyBellDecrypt: true,
          deviceSerialNumber: entry.deviceSerialNumber ?? '00000000',
        }),
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
        body: JSON.stringify({ portName }),
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
        body: JSON.stringify({ portName: entry.portName }),
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
      if (editingPortId) {
        setPorts((prev) =>
          prev.map((p) =>
            p.id === editingPortId
              ? {
                  ...p,
                  portName: addForm.portName.trim(),
                  baudRate: addForm.baudRate,
                  autoConnect: addForm.autoConnect,
                  secureEnabled: addForm.secureEnabled,
                  allowLegacyBellDecrypt: true,
                  deviceSerialNumber: addForm.deviceSerialNumber.trim() || '00000000',
                }
              : p,
          ),
        );
      } else {
        const res = await fetch(`${apiUrl}/api/serialport/ports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portName: addForm.portName,
            baudRate: addForm.baudRate,
            autoConnect: addForm.autoConnect,
            secureEnabled: addForm.secureEnabled,
            allowLegacyBellDecrypt: true,
            deviceSerialNumber: addForm.deviceSerialNumber.trim() || '00000000',
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || '추가 실패');
        }
        await loadSettings();
      }
      setShowAddModal(false);
      setEditingPortId(null);
      setAddForm({
        portName: 'COM1',
        baudRate: 9600,
        autoConnect: true,
        secureEnabled: false,
        deviceSerialNumber: '00000000',
      });
    } catch (e: unknown) {
      await showCustomAlert(e instanceof Error ? e.message : 'COM 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingPortId(null);
    setAddForm({
      portName: 'COM1',
      baudRate: 9600,
      autoConnect: true,
      secureEnabled: false,
      deviceSerialNumber: '00000000',
    });
    setShowAddModal(true);
  };

  const openEditModal = (entry: SerialPortEntry) => {
    setEditingPortId(entry.id);
    setAddForm({
      id: entry.id,
      portName: entry.portName,
      baudRate: entry.baudRate ?? 9600,
      autoConnect: entry.autoConnect ?? true,
      secureEnabled: entry.secureEnabled ?? false,
      deviceSerialNumber: entry.deviceSerialNumber ?? '00000000',
    });
    setShowAddModal(true);
  };

  async function handlePasswordSubmit() {
    if (password === systemAccessPassword) {
      setShowPasswordDialog(false);
      setPassword('');
      setShowLogViewer(true);
    } else {
      await showCustomAlert('비밀번호가 올바르지 않습니다.');
      setPassword('');
    }
  }

  return (
    <>
      <div className="serial-port-modal-body">
        <div className="serial-port-toolbar">
          {!serialEncryptionMaster && (
            <p className="serial-encryption-master-hint" style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
              시스템 설정에서 &quot;시리얼 암호화(보안) 사용&quot;이 꺼져 있어, 포트에 저장된 보안 옵션은 연결 시 적용되지 않습니다(기본 OFF).
            </p>
          )}
          <div className="form-inline">
            <label>검색 Baud</label>
            <select value={scanBaudRate} onChange={(e) => setScanBaudRate(Number(e.target.value))}>
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
          <button type="button" className="save-button" onClick={openAddModal} disabled={loading}>
            수동 COM 추가
          </button>
          <button type="button" className="log-button" onClick={() => setShowPasswordDialog(true)}>
            로그
          </button>
        </div>

        <div className="serial-port-list">
          <div className="serial-port-list-header">
            <span>등록된 COM</span>
            <span>Baud</span>
            <span>자동연결</span>
            <span>보안</span>
            <span>단말 시리얼</span>
            <span>상태</span>
            <span>동작</span>
          </div>
          {ports.length === 0 ? (
            <div className="serial-port-list-empty">등록된 포트가 없습니다. 자동 검색 또는 수동 추가를 이용하세요.</div>
          ) : (
            ports.map((entry) => {
              const connected = isPortConnected(entry.portName);
              return (
                <div key={entry.id} className="serial-port-row">
                  <span className="port-name">{entry.portName}</span>
                  <span className="port-baud">{entry.baudRate}</span>
                  <span className="port-auto-connect">{entry.autoConnect ? '예' : '아니오'}</span>
                  <span className="port-secure-enabled">
                    {serialEncryptionMaster ? (entry.secureEnabled ? '예' : '아니오') : '미적용'}
                  </span>
                  <span className="port-device-sn">{entry.deviceSerialNumber || '00000000'}</span>
                  <span className={`port-status ${connected ? 'connected' : 'disconnected'}`}>
                    {connected ? '✓ 연결됨' : '✗ 해제'}
                  </span>
                  <span className="port-actions">
                    <button type="button" className="edit-button small" onClick={() => openEditModal(entry)} disabled={loading}>
                      수정
                    </button>
                    {connected ? (
                      <button
                        type="button"
                        className="disconnect-button small"
                        onClick={() => handleDisconnect(entry.portName)}
                        disabled={loading}
                      >
                        해제
                      </button>
                    ) : (
                      <button type="button" className="connect-button small" onClick={() => handleConnect(entry)} disabled={loading}>
                        연결
                      </button>
                    )}
                    <button type="button" className="remove-button small" onClick={() => handleRemovePort(entry)} disabled={loading}>
                      삭제
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="serial-port-modal-actions">
          {variant === 'modal' && (
            <button type="button" className="cancel-button" onClick={() => onClose?.()}>
              취소
            </button>
          )}
          <button type="button" className="save-button" onClick={handleSaveOnly} disabled={loading}>
            저장만
          </button>
          <button type="button" className="save-button primary" onClick={handleSave} disabled={loading}>
            저장 후 자동연결 포트 연결
          </button>
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
                if (e.key === 'Enter') void handlePasswordSubmit();
              }}
              placeholder="비밀번호를 입력하세요"
              autoFocus
            />
            <div className="password-dialog-actions">
              <button type="button" onClick={() => { setShowPasswordDialog(false); setPassword(''); }}>
                취소
              </button>
              <button type="button" onClick={() => void handlePasswordSubmit()}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay serial-add-overlay" onClick={() => { setShowAddModal(false); setEditingPortId(null); }}>
          <div className="modal-content serial-add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPortId ? 'COM 수정' : '수동 COM 추가'}</h2>
              <button type="button" className="modal-close" onClick={() => { setShowAddModal(false); setEditingPortId(null); }}>
                ×
              </button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>포트 이름</label>
                <select value={addForm.portName} onChange={(e) => setAddForm((f) => ({ ...f, portName: e.target.value }))}>
                  {availablePorts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  {availablePorts.length === 0 && <option value="COM1">COM1</option>}
                </select>
              </div>
              <div className="form-group">
                <label>전송 속도 (Baud)</label>
                <select value={addForm.baudRate} onChange={(e) => setAddForm((f) => ({ ...f, baudRate: Number(e.target.value) }))}>
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={addForm.autoConnect}
                    onChange={(e) => setAddForm((f) => ({ ...f, autoConnect: e.target.checked }))}
                  />
                  자동 연결
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={addForm.secureEnabled}
                    disabled={!serialEncryptionMaster}
                    onChange={(e) => setAddForm((f) => ({ ...f, secureEnabled: e.target.checked }))}
                  />
                  보안(암호화) 사용
                </label>
                {!serialEncryptionMaster && (
                  <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#888' }}>
                    시스템 설정에서 시리얼 암호화를 켠 뒤 적용됩니다.
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>단말 시리얼번호 (8자)</label>
                <input
                  type="text"
                  value={addForm.deviceSerialNumber}
                  onChange={(e) => setAddForm((f) => ({ ...f, deviceSerialNumber: e.target.value }))}
                  placeholder="00000000"
                  maxLength={8}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => { setShowAddModal(false); setEditingPortId(null); }}>
                  취소
                </button>
                <button type="button" className="save-button" onClick={() => void handleAddPort()} disabled={loading}>
                  {editingPortId ? '수정 반영' : '추가'}
                </button>
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
    </>
  );
}

export default SerialPortSettingsPanel;
