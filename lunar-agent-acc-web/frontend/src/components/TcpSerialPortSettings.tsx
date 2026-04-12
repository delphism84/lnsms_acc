import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiBaseUrl } from '../services/api';
import { showCustomAlert } from './CustomAlert';
import '../styles/TcpSerialPortSettings.css';

export type NetworkTransportRow = {
  id: string;
  name: string;
  protocol: 'tcp' | 'udp';
  host: string;
  port: number;
  enabled: boolean;
  autoConnect: boolean;
};

function newId() {
  return `nt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseApiRow(r: Record<string, unknown>): NetworkTransportRow {
  const proto = String(r.protocol ?? 'tcp').toLowerCase() === 'udp' ? 'udp' : 'tcp';
  const portRaw = r.port;
  let port = typeof portRaw === 'number' ? portRaw : parseInt(String(portRaw ?? '0'), 10);
  if (Number.isNaN(port) || port < 0) port = 0;
  return {
    id: String(r.id ?? newId()),
    name: String(r.name ?? ''),
    protocol: proto,
    host: String(r.host ?? '127.0.0.1'),
    port,
    enabled: r.enabled !== false,
    autoConnect: r.autoConnect !== false,
  };
}

function TcpSerialPortSettings() {
  const [rows, setRows] = useState<NetworkTransportRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    protocol: 'tcp' as 'tcp' | 'udp',
    host: '127.0.0.1',
    port: '23',
    enabled: true,
    autoConnect: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const api = await getApiBaseUrl();
      const res = await fetch(`${api}/api/network-transport/settings`);
      if (!res.ok) throw new Error('설정을 불러오지 못했습니다.');
      const data = (await res.json()) as { links?: unknown[] };
      const list = Array.isArray(data.links) ? data.links : [];
      setRows(list.map((x) => parseApiRow(x as Record<string, unknown>)));
    } catch (e) {
      console.error(e);
      await showCustomAlert(e instanceof Error ? e.message : '로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRows = useCallback(async (next: NetworkTransportRow[]) => {
    setSaving(true);
    try {
      const api = await getApiBaseUrl();
      const res = await fetch(`${api}/api/network-transport/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          links: next.map((r) => ({
            id: r.id,
            name: r.name,
            protocol: r.protocol,
            host: r.host,
            port: r.port,
            enabled: r.enabled,
            autoConnect: r.autoConnect,
          })),
        }),
      });
      if (!res.ok) throw new Error('저장에 실패했습니다.');
      const data = (await res.json()) as { settings?: { links?: unknown[] } };
      const list = data.settings?.links;
      if (Array.isArray(list))
        setRows(list.map((x) => parseApiRow(x as Record<string, unknown>)));
      else setRows(next);
    } catch (e) {
      console.error(e);
      await showCustomAlert(e instanceof Error ? e.message : '저장 실패');
      await load();
    } finally {
      setSaving(false);
    }
  }, [load]);

  const addRow = useCallback(() => {
    const name = draft.name.trim();
    const host = draft.host.trim();
    const portNum = parseInt(draft.port.trim(), 10);
    if (!name || !host) return;
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      void showCustomAlert('포트는 1~65535 사이 숫자여야 합니다.');
      return;
    }
    const row: NetworkTransportRow = {
      id: newId(),
      name,
      protocol: draft.protocol,
      host,
      port: portNum,
      enabled: draft.enabled,
      autoConnect: draft.autoConnect,
    };
    const next = [...rows, row];
    setRows(next);
    setDraft({ name: '', protocol: 'tcp', host: '127.0.0.1', port: '23', enabled: true, autoConnect: true });
    void saveRows(next);
  }, [draft, rows, saveRows]);

  const removeRow = useCallback(
    (id: string) => {
      const next = rows.filter((r) => r.id !== id);
      setRows(next);
      void saveRows(next);
    },
    [rows, saveRows]
  );

  const patchRow = useCallback(
    (id: string, patch: Partial<NetworkTransportRow>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    []
  );

  const commitRow = useCallback(
    (id: string) => {
      const r = rowsRef.current.find((x) => x.id === id);
      if (!r) return;
      if (!r.host.trim()) {
        void showCustomAlert('호스트를 입력하세요.');
        return;
      }
      if (r.port < 1 || r.port > 65535) {
        void showCustomAlert('포트는 1~65535 사이여야 합니다.');
        void load();
        return;
      }
      void saveRows(rowsRef.current);
    },
    [load, saveRows]
  );

  if (loading) {
    return <div className="tcp-serial-settings tcp-serial-loading">불러오는 중…</div>;
  }

  return (
    <div className="tcp-serial-settings">
      <p className="tcp-serial-intro">
        TCP 또는 UDP로 원격 장비와 연결한 뒤, 수신 라인은 시리얼과 동일한 규칙(bell= 등)으로 처리됩니다. 저장 시 에이전트가 연결을 다시 시도합니다.
      </p>
      {saving ? <div className="tcp-serial-saving">저장 중…</div> : null}
      <div className="tcp-serial-add-card">
        <div className="tcp-serial-add-grid">
          <div className="form-group">
            <label>이름</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="표시 이름"
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>프로토콜</label>
            <select
              value={draft.protocol}
              onChange={(e) =>
                setDraft((d) => ({ ...d, protocol: e.target.value === 'udp' ? 'udp' : 'tcp' }))
              }
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </div>
          <div className="form-group">
            <label>호스트 (IP)</label>
            <input
              type="text"
              value={draft.host}
              onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))}
              placeholder="192.168.0.1"
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>포트</label>
            <input
              type="text"
              inputMode="numeric"
              value={draft.port}
              onChange={(e) => setDraft((d) => ({ ...d, port: e.target.value }))}
              placeholder="23"
              autoComplete="off"
            />
          </div>
          <div className="form-group tcp-serial-check">
            <label>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />
              사용
            </label>
          </div>
          <div className="form-group tcp-serial-check">
            <label>
              <input
                type="checkbox"
                checked={draft.autoConnect}
                onChange={(e) => setDraft((d) => ({ ...d, autoConnect: e.target.checked }))}
              />
              자동 연결
            </label>
          </div>
        </div>
        <div className="tcp-serial-add-actions">
          <button type="button" className="tcp-btn-primary" onClick={() => void addRow()}>
            추가 후 저장
          </button>
        </div>
      </div>

      <div className="tcp-serial-table-wrap">
        <div className="tcp-serial-table-header">
          <span>이름</span>
          <span>프로토콜</span>
          <span>호스트</span>
          <span>포트</span>
          <span>사용</span>
          <span>자동</span>
          <span className="tcp-serial-col-actions"> </span>
        </div>
        {rows.length === 0 ? (
          <div className="tcp-serial-empty">등록된 TCP/UDP 링크가 없습니다.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="tcp-serial-table-row tcp-serial-table-row-edit">
              <input
                className="tcp-cell-input"
                value={r.name}
                onChange={(e) => patchRow(r.id, { name: e.target.value })}
                onBlur={() => commitRow(r.id)}
              />
              <select
                className="tcp-cell-select"
                value={r.protocol}
                onChange={(e) => {
                  const p: 'tcp' | 'udp' = e.target.value === 'udp' ? 'udp' : 'tcp';
                  const next: NetworkTransportRow[] = rowsRef.current.map((x) =>
                    x.id === r.id ? { ...x, protocol: p } : x
                  );
                  setRows(next);
                  void saveRows(next);
                }}
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
              <input
                className="tcp-cell-input"
                value={r.host}
                onChange={(e) => patchRow(r.id, { host: e.target.value })}
                onBlur={() => commitRow(r.id)}
              />
              <input
                className="tcp-cell-input tcp-cell-port"
                type="text"
                inputMode="numeric"
                value={String(r.port)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  patchRow(r.id, { port: Number.isNaN(n) ? 0 : n });
                }}
                onBlur={() => commitRow(r.id)}
              />
              <label className="tcp-serial-inline-check">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => {
                    const next = rows.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x));
                    setRows(next);
                    void saveRows(next);
                  }}
                />
              </label>
              <label className="tcp-serial-inline-check">
                <input
                  type="checkbox"
                  checked={r.autoConnect}
                  onChange={(e) => {
                    const next = rows.map((x) => (x.id === r.id ? { ...x, autoConnect: e.target.checked } : x));
                    setRows(next);
                    void saveRows(next);
                  }}
                />
              </label>
              <span className="tcp-serial-col-actions">
                <button type="button" className="tcp-btn-neutral tcp-row-remove" onClick={() => void removeRow(r.id)}>
                  삭제
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TcpSerialPortSettings;
