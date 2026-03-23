'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import type { PhraseItem, SerialPortEntry, SetConfig } from '@/lib/api';
import PhraseModal from '@/components/PhraseModal';
import SerialPortModal from '@/components/SerialPortModal';
import styles from './manage.module.css';

type TabId = 'phrases' | 'rf' | 'settings';

interface User {
  userid: string;
}
interface Store {
  storeid: string;
  userid?: string;
  setids?: string[];
}
interface SetItem {
  setid: string;
  userid?: string;
  updatedAt?: string;
}

const DEFAULT_BELL_CODE = 'crcv.assist';

function normalizePhrase(p: unknown): PhraseItem {
  const q = p as Record<string, unknown>;
  return {
    uid: String(q?.uid ?? q?.Uid ?? ''),
    text: String(q?.text ?? q?.Text ?? ''),
    isEnabled: Boolean(q?.isEnabled ?? q?.IsEnabled ?? true),
    color: String(q?.color ?? q?.Color ?? '#000000'),
    bellCodes: Array.isArray(q?.bellCodes) ? q.bellCodes as string[] : (Array.isArray(q?.BellCodes) ? q.BellCodes as string[] : []),
    autoCloseEnabled: Boolean(q?.autoCloseEnabled ?? q?.AutoCloseEnabled),
    autoCloseSeconds: Number(q?.autoCloseSeconds ?? q?.AutoCloseSeconds ?? 10),
    image: q?.image != null ? String(q.image) : (q?.imageUrl != null ? String(q.imageUrl) : null),
    imageUrl: q?.imageUrl != null ? String(q.imageUrl) : (q?.image != null ? String(q.image) : null),
    makerId: q?.makerId != null ? String(q.makerId) : (q?.MakerId != null ? String(q.MakerId) : null),
    modelId: q?.modelId != null ? String(q.modelId) : (q?.ModelId != null ? String(q.ModelId) : null),
    createdAt: q?.createdAt != null ? String(q.createdAt) : undefined,
    updatedAt: q?.updatedAt != null ? String(q.updatedAt) : undefined,
  };
}

function normalizePort(p: unknown): SerialPortEntry {
  const q = p as Record<string, unknown>;
  return {
    id: String(q?.id ?? `port-${Date.now()}`),
    portName: String(q?.portName ?? q?.PortName ?? 'COM1'),
    baudRate: Number(q?.baudRate ?? q?.BaudRate ?? 9600),
    autoConnect: Boolean(q?.autoConnect ?? q?.AutoConnect ?? true),
    secureEnabled: Boolean(q?.secureEnabled ?? q?.SecureEnabled),
    deviceSerialNumber: String(q?.deviceSerialNumber ?? q?.DeviceSerialNumber ?? '00000000'),
  };
}

export default function ManagePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('phrases');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SetConfig | null>(null);

  const [phraseModalOpen, setPhraseModalOpen] = useState(false);
  const [phraseModalMode, setPhraseModalMode] = useState<'add' | 'edit'>('edit');
  const [editingPhrase, setEditingPhrase] = useState<PhraseItem | null>(null);

  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [editingPort, setEditingPort] = useState<SerialPortEntry | null>(null);

  const [addToStoreModalStoreId, setAddToStoreModalStoreId] = useState<string | null>(null);
  const [addToStoreModalOpen, setAddToStoreModalOpen] = useState(false);
  const [selectedSetIdsForAdd, setSelectedSetIdsForAdd] = useState<Set<string>>(new Set());
  const [addSetUserid, setAddSetUserid] = useState<string | null>(null);
  const [addSetInput, setAddSetInput] = useState('');
  const [addStoreUserid, setAddStoreUserid] = useState<string | null>(null);
  const [addStoreInput, setAddStoreInput] = useState('');
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addUserPw, setAddUserPw] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const list = await api.getUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      setUsers([]);
    }
  }, []);

  const loadStores = useCallback(async () => {
    try {
      const list = await api.getStores();
      setStores(Array.isArray(list) ? list : []);
    } catch {
      setStores([]);
    }
  }, []);

  const loadSets = useCallback(async () => {
    try {
      const list = await api.getSets(); // userid 없으면 전체 (트리에서 user별로 필터)
      setSets(Array.isArray(list) ? list : []);
    } catch {
      setSets([]);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadStores();
    loadSets();
  }, [loadUsers, loadStores, loadSets]);

  useEffect(() => {
    if (selectedSetId) {
      setLoading(true);
      api
        .getSetConfig(selectedSetId)
        .then((c: Record<string, unknown>) => {
          const phrases = (Array.isArray(c.phrases) ? c.phrases : []).map(normalizePhrase);
          const rawPorts = (c.serial as Record<string, unknown>)?.ports;
          const ports = (Array.isArray(rawPorts) ? rawPorts : []).map(normalizePort);
          setConfig({
            setid: selectedSetId,
            phrases,
            serial: { ports },
          });
          setLoading(false);
        })
        .catch(() => {
          setConfig(null);
          setLoading(false);
        });
    } else {
      setConfig(null);
    }
  }, [selectedSetId]);

  const handleAddSetUnderUser = async (userid: string) => {
    const id = addSetInput.trim();
    if (!id) return;
    try {
      await api.createSet(id, userid);
      setAddSetInput('');
      setAddSetUserid(null);
      await loadSets();
    } catch (e) {
      alert(e instanceof Error ? e.message : '추가 실패');
    }
  };

  const handleDeleteSetFromList = async (setid: string) => {
    if (!confirm(`세트 "${setid}"을(를) 삭제할까요?`)) return;
    try {
      await api.deleteSet(setid);
      if (selectedSetId === setid) setSelectedSetId(null);
      await loadSets();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const openAddToStoreModal = (store: Store) => {
    setAddToStoreModalStoreId(store.storeid);
    setSelectedSetIdsForAdd(new Set(store.setids ?? []));
    setAddToStoreModalOpen(true);
  };

  const handleAddToStoreConfirm = async () => {
    if (!addToStoreModalStoreId) return;
    try {
      await api.updateStoreSetids(addToStoreModalStoreId, Array.from(selectedSetIdsForAdd));
      setAddToStoreModalOpen(false);
      setAddToStoreModalStoreId(null);
      setSelectedSetIdsForAdd(new Set());
      await loadStores();
    } catch (e) {
      alert(e instanceof Error ? e.message : '세트 선택 저장 실패');
    }
  };

  const handleAddStoreUnderUser = async (userid: string) => {
    const id = addStoreInput.trim();
    if (!id) return;
    try {
      await api.createStore(id, userid);
      setAddStoreInput('');
      setAddStoreUserid(null);
      await loadStores();
    } catch (e) {
      alert(e instanceof Error ? e.message : '매장 추가 실패');
    }
  };

  const handleAddUser = async () => {
    const uid = addUserId.trim();
    const pw = addUserPw.trim();
    if (!uid || !pw) {
      alert('아이디와 비밀번호를 입력하세요.');
      return;
    }
    try {
      await api.createUser(uid, pw);
      setAddUserId('');
      setAddUserPw('');
      setAddUserOpen(false);
      await loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : '유저 추가 실패');
    }
  };

  const handleDeleteUser = async (userid: string) => {
    if (!confirm(`유저 "${userid}"을(를) 삭제할까요?`)) return;
    try {
      await api.deleteUser(userid);
      if (selectedSetId) setSelectedSetId(null);
      await loadUsers();
      await loadStores();
      await loadSets();
    } catch (e) {
      alert(e instanceof Error ? e.message : '유저 삭제 실패');
    }
  };

  const handleDeleteStore = async (storeid: string) => {
    if (!confirm(`매장 "${storeid}"을(를) 삭제할까요? (연결된 세트 목록만 해제됩니다)`)) return;
    try {
      await api.deleteStore(storeid);
      await loadStores();
    } catch (e) {
      alert(e instanceof Error ? e.message : '매장 삭제 실패');
    }
  };

  const handleDeleteSet = async () => {
    if (!selectedSetId) return;
    if (!confirm(`세트 "${selectedSetId}"을(를) 삭제할까요?`)) return;
    try {
      await api.deleteSet(selectedSetId);
      setSelectedSetId(null);
      setConfig(null);
      await loadSets();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const phrases = config?.phrases ?? [];
  const ports = config?.serial?.ports ?? [];

  const handleAddPhrase = () => {
    setEditingPhrase(null);
    setPhraseModalMode('add');
    setPhraseModalOpen(true);
  };

  const handleEditPhrase = (phrase: PhraseItem) => {
    setEditingPhrase(phrase);
    setPhraseModalMode('edit');
    setPhraseModalOpen(true);
  };

  const handlePhraseSave = async (data: Partial<PhraseItem>) => {
    if (!config || !selectedSetId) return;
    const uid = editingPhrase?.uid ?? `ph-${Date.now()}`;
    const newPhrase: PhraseItem = {
      uid,
      text: data.text ?? '',
      isEnabled: data.isEnabled ?? true,
      color: data.color ?? '#000000',
      bellCodes: data.bellCodes ?? [],
      autoCloseEnabled: data.autoCloseEnabled,
      autoCloseSeconds: data.autoCloseSeconds ?? 10,
      image: data.image ?? null,
      imageUrl: data.image ?? data.imageUrl ?? null,
      makerId: data.makerId ?? null,
      modelId: data.modelId ?? null,
    };
    const idx = config.phrases.findIndex((p) => p.uid === uid);
    const nextPhrases = [...config.phrases];
    if (idx >= 0) nextPhrases[idx] = newPhrase;
    else nextPhrases.push(newPhrase);
    const nextConfig = { ...config, phrases: nextPhrases };
    try {
      await api.saveSetConfig(selectedSetId, nextConfig);
      setConfig(nextConfig);
      setPhraseModalOpen(false);
      setEditingPhrase(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
      throw e;
    }
  };

  const handleDeletePhrase = async (phrase: PhraseItem) => {
    const isDefault = phrase.bellCodes?.some((c) => c?.toLowerCase().trim() === DEFAULT_BELL_CODE);
    if (isDefault) {
      alert('기본 문구(crcv.assist)는 삭제할 수 없습니다.');
      return;
    }
    if (!confirm('이 문구를 삭제하시겠습니까?')) return;
    if (!config || !selectedSetId) return;
    const nextConfig = {
      ...config,
      phrases: config.phrases.filter((p) => p.uid !== phrase.uid),
    };
    try {
      await api.saveSetConfig(selectedSetId, nextConfig);
      setConfig(nextConfig);
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    }
  };

  const handleBroadcast = async (phrase: PhraseItem) => {
    const code = phrase.bellCodes?.[0]?.trim();
    if (!code) {
      alert('이 문구에 등록된 벨이 없습니다.');
      return;
    }
    try {
      await api.broadcast(code);
      alert(`"${code}" 브로드캐스트를 요청했습니다. 등록된 모든 매장에 RX가 전파됩니다.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '브로드캐스트 실패');
    }
  };

  const handleAddPort = () => {
    setEditingPort(null);
    setSerialModalOpen(true);
  };

  const handleEditPort = (port: SerialPortEntry) => {
    setEditingPort(port);
    setSerialModalOpen(true);
  };

  const handlePortSave = async (entry: Omit<SerialPortEntry, 'id'> & { id?: string }) => {
    if (!config || !selectedSetId) return;
    const id = entry.id ?? editingPort?.id ?? `port-${Date.now()}`;
    const newPort: SerialPortEntry = {
      id,
      portName: entry.portName,
      baudRate: entry.baudRate,
      autoConnect: entry.autoConnect,
      secureEnabled: entry.secureEnabled,
      deviceSerialNumber: entry.deviceSerialNumber ?? '00000000',
    };
    const nextPorts = [...(config.serial?.ports ?? [])];
    const idx = nextPorts.findIndex((p) => p.id === id);
    if (idx >= 0) nextPorts[idx] = newPort;
    else nextPorts.push(newPort);
    const nextConfig = { ...config, serial: { ...config.serial, ports: nextPorts } };
    try {
      await api.saveSetConfig(selectedSetId, nextConfig);
      setConfig(nextConfig);
      setSerialModalOpen(false);
      setEditingPort(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
      throw e;
    }
  };

  const handleRemovePort = async (port: SerialPortEntry) => {
    if (!confirm(`"${port.portName}"을(를) 목록에서 제거할까요?`)) return;
    if (!config || !selectedSetId) return;
    const nextConfig = {
      ...config,
      serial: {
        ...config.serial,
        ports: (config.serial?.ports ?? []).filter((p) => p.id !== port.id),
      },
    };
    try {
      await api.saveSetConfig(selectedSetId, nextConfig);
      setConfig(nextConfig);
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>LNSMS Admin</div>
        <nav className={styles.sidebarNav}>
          <a href="/manage">유저/매장 관리</a>
        </nav>
      </aside>

      <div className={styles.treePanel}>
        <div className={styles.treeTitle}>트리</div>
        <div className={styles.treeScroll}>
          <div className={styles.treeUserAddSection}>
            <button
              type="button"
              className={styles.treeUserAddToggle}
              onClick={() => { setAddUserOpen((v) => !v); if (!addUserOpen) { setAddUserId(''); setAddUserPw(''); } }}
            >
              {addUserOpen ? '취소' : '+ 유저 추가'}
            </button>
            {addUserOpen && (
              <div className={styles.treeAddInline}>
                <input
                  type="text"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  placeholder="userid"
                  className={styles.treeAddInput}
                />
                <input
                  type="text"
                  value={addUserPw}
                  onChange={(e) => setAddUserPw(e.target.value)}
                  placeholder="password"
                  className={styles.treeAddInput}
                />
                <button type="button" className={styles.treeAddBtn} onClick={handleAddUser}>추가</button>
              </div>
            )}
          </div>
          {users.map((u) => (
            <div key={u.userid} className={styles.treeUser}>
              <div className={styles.treeUserRow}>
                <span className={styles.treeUserLabel}>👤 {u.userid}</span>
                <button
                  type="button"
                  className={styles.treeSetListDeleteBtn}
                  onClick={() => handleDeleteUser(u.userid)}
                  title="유저 삭제"
                >
                  삭제
                </button>
              </div>

              <div className={styles.treeNodeSection}>
                <div className={styles.treeNodeRow}>
                  <span className={styles.treeNodeLabel}>📋 세트ID 목록</span>
                  <button
                    type="button"
                    className={styles.treeNodeAddBtn}
                    onClick={() => { setAddSetUserid(u.userid); setAddSetInput(''); }}
                    title="세트 추가"
                  >
                    +
                  </button>
                </div>
                {addSetUserid === u.userid && (
                  <div className={styles.treeAddInline}>
                    <input
                      type="text"
                      value={addSetInput}
                      onChange={(e) => setAddSetInput(e.target.value)}
                      placeholder="세트 ID"
                      className={styles.treeAddInput}
                      autoFocus
                    />
                    <button type="button" className={styles.treeAddBtn} onClick={() => handleAddSetUnderUser(u.userid)}>추가</button>
                    <button type="button" className={styles.treeAddBtn} onClick={() => { setAddSetUserid(null); setAddSetInput(''); }}>취소</button>
                  </div>
                )}
                {sets.filter((x) => x.userid === u.userid).map((x) => (
                  <div key={x.setid} className={styles.treeSetListRow}>
                    <button
                      type="button"
                      className={`${styles.treeSetBtn} ${selectedSetId === x.setid ? styles.active : ''}`}
                      onClick={() => setSelectedSetId(x.setid)}
                    >
                      📁 {x.setid}
                    </button>
                    <button
                      type="button"
                      className={styles.treeSetListDeleteBtn}
                      onClick={() => handleDeleteSetFromList(x.setid)}
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.treeNodeSection}>
                <div className={styles.treeNodeRow}>
                  <span className={styles.treeNodeLabel}>🏪 매장ID 목록</span>
                  <button
                    type="button"
                    className={styles.treeNodeAddBtn}
                    onClick={() => { setAddStoreUserid(u.userid); setAddStoreInput(''); }}
                    title="매장 추가"
                  >
                    +
                  </button>
                </div>
                {addStoreUserid === u.userid && (
                  <div className={styles.treeAddInline}>
                    <input
                      type="text"
                      value={addStoreInput}
                      onChange={(e) => setAddStoreInput(e.target.value)}
                      placeholder="매장 ID"
                      className={styles.treeAddInput}
                      autoFocus
                    />
                    <button type="button" className={styles.treeAddBtn} onClick={() => handleAddStoreUnderUser(u.userid)}>추가</button>
                    <button type="button" className={styles.treeAddBtn} onClick={() => { setAddStoreUserid(null); setAddStoreInput(''); }}>취소</button>
                  </div>
                )}
                {stores.filter((s) => s.userid === u.userid).map((s) => (
                  <div key={s.storeid} className={styles.treeStore}>
                    <div className={styles.treeStoreRow}>
                      <span className={styles.treeStoreLabel}>🏪 {s.storeid}</span>
                      <button
                        type="button"
                        className={styles.treeStoreAddBtn}
                        onClick={() => openAddToStoreModal(s)}
                        title="세트 선택"
                      >
                        세트 선택
                      </button>
                      <button
                        type="button"
                        className={styles.treeStoreDeleteBtn}
                        onClick={() => handleDeleteStore(s.storeid)}
                        title="매장 삭제"
                      >
                        삭제
                      </button>
                    </div>
                    {(s.setids ?? []).length > 0 && (
                      <div className={styles.treeSetIdsUnderStore}>
                        {(s.setids ?? []).map((sid) => (
                          <div key={sid} className={styles.treeSetUnderStore}>
                            <button
                              type="button"
                              className={`${styles.treeSetBtn} ${selectedSetId === sid ? styles.active : ''}`}
                              onClick={() => setSelectedSetId(sid)}
                            >
                              📁 {sid}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <main className={styles.main}>
        <header className={styles.appBar}>
          <span className={selectedSetId ? styles.appBarTitle : `${styles.appBarTitle} ${styles.empty}`}>
            {selectedSetId ? `세트: ${selectedSetId}` : '세트를 선택하세요'}
          </span>
          <div className={styles.appBarActions}>
            <button
              type="button"
              className={`${styles.appBarBtn} ${styles.delete}`}
              onClick={handleDeleteSet}
              disabled={!selectedSetId}
            >
              세트 삭제
            </button>
          </div>
        </header>

        <div className={styles.tabs}>
          {(['phrases', 'rf', 'settings'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${tab === t ? styles.active : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'phrases' ? '문구관리' : t === 'rf' ? 'RF모듈관리(COM,TCP)' : '설정관리'}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>
          {loading && <p className={styles.loading}>로딩 중...</p>}
          {!selectedSetId && !loading && (
            <p className={styles.tabContentEmpty}>왼쪽에서 세트를 선택하거나 새 세트를 추가하세요.</p>
          )}

          {selectedSetId && config && !loading && (
            <>
              {tab === 'phrases' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>문구 관리</h2>
                    <button type="button" className={styles.addBtn} onClick={handleAddPhrase}>
                      + 문구 추가
                    </button>
                  </div>
                  {phrases.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>등록된 문구가 없습니다.</p>
                      <button type="button" className={styles.addBtn} onClick={handleAddPhrase}>
                        첫 문구 추가하기
                      </button>
                    </div>
                  ) : (
                    <div className={styles.phrasesList}>
                      {phrases.map((phrase) => {
                        const isDefault = phrase.bellCodes?.some(
                          (c) => c?.toLowerCase().trim() === DEFAULT_BELL_CODE
                        );
                        return (
                          <div key={phrase.uid} className={styles.phraseItem}>
                            <div className={styles.phraseContent}>
                              <div className={styles.phraseText}>{phrase.text || '(빈 문구)'}</div>
                              <div className={styles.phraseMeta}>
                                <span className={`${styles.phraseStatus} ${phrase.isEnabled ? styles.enabled : styles.disabled}`}>
                                  {phrase.isEnabled ? '활성' : '비활성'}
                                </span>
                                <span>벨 {phrase.bellCodes?.length ?? 0}개</span>
                              </div>
                            </div>
                            <div className={styles.phraseActions}>
                              <button
                                type="button"
                                className={styles.broadcastBtn}
                                onClick={() => handleBroadcast(phrase)}
                                title="서버로 브로드캐스팅 (모든 매장에 RX 전파)"
                              >
                                브로드캐스트
                              </button>
                              <button type="button" className={styles.editBtn} onClick={() => handleEditPhrase(phrase)}>
                                수정
                              </button>
                              {!isDefault && (
                                <button
                                  type="button"
                                  className={styles.deleteBtn}
                                  onClick={() => handleDeletePhrase(phrase)}
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === 'rf' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>RF 모듈 (COM)</h2>
                    <button type="button" className={styles.rfAddBtn} onClick={handleAddPort}>
                      수동 COM 추가
                    </button>
                  </div>
                  {ports.length === 0 ? (
                    <div className={styles.portsEmpty}>
                      등록된 포트가 없습니다. 수동 COM 추가를 이용하세요.
                    </div>
                  ) : (
                    <table className={styles.portsTable}>
                      <thead>
                        <tr>
                          <th>포트명</th>
                          <th>Baud</th>
                          <th>자동연결</th>
                          <th>보안</th>
                          <th>단말 시리얼</th>
                          <th>동작</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ports.map((p) => (
                          <tr key={p.id}>
                            <td>{p.portName}</td>
                            <td>{p.baudRate}</td>
                            <td>{p.autoConnect ? '예' : '아니오'}</td>
                            <td>{p.secureEnabled ? '예' : '아니오'}</td>
                            <td>{p.deviceSerialNumber ?? '—'}</td>
                            <td>
                              <div className={styles.portActions}>
                                <button
                                  type="button"
                                  className={styles.editBtn}
                                  onClick={() => handleEditPort(p)}
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  className={styles.removeBtn}
                                  onClick={() => handleRemovePort(p)}
                                >
                                  제거
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'settings' && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>설정 관리</h2>
                  <p className={styles.settingsHint}>
                    문구·RF(COM) 변경은 모달에서 확인 시 서버에 바로 저장됩니다.
                    에이전트에서 이 세트를 다운로드하면 동일한 문구/COM 설정이 적용됩니다.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {phraseModalOpen && (
        <PhraseModal
          mode={phraseModalMode}
          phrase={editingPhrase}
          onSave={handlePhraseSave}
          onClose={() => {
            setPhraseModalOpen(false);
            setEditingPhrase(null);
          }}
        />
      )}

      {serialModalOpen && (
        <SerialPortModal
          port={editingPort}
          onSave={handlePortSave}
          onClose={() => {
            setSerialModalOpen(false);
            setEditingPort(null);
          }}
        />
      )}

      {addToStoreModalOpen && addToStoreModalStoreId && (() => {
        const store = stores.find((s) => s.storeid === addToStoreModalStoreId);
        const userSets = store ? sets.filter((x) => x.userid === store.userid) : [];
        return (
          <div className={styles.modalOverlay} onClick={() => setAddToStoreModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>세트 선택 — {addToStoreModalStoreId}</h2>
                <button type="button" className={styles.modalClose} onClick={() => setAddToStoreModalOpen(false)} aria-label="닫기">×</button>
              </div>
              <p className={styles.modalHint}>이 매장에서 내려받기 가능한 세트를 멀티 선택 후 저장하세요.</p>
              <div className={styles.modalSetList}>
                {userSets.length === 0 ? (
                  <p className={styles.treeSetListEmpty}>해당 유저의 세트가 없습니다. 세트ID 목록에서 먼저 추가하세요.</p>
                ) : (
                  userSets.map((x) => (
                    <label key={x.setid} className={styles.modalSetCheckRow}>
                      <input
                        type="checkbox"
                        checked={selectedSetIdsForAdd.has(x.setid)}
                        onChange={(e) => {
                          setSelectedSetIdsForAdd((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(x.setid);
                            else next.delete(x.setid);
                            return next;
                          });
                        }}
                      />
                      <span>📁 {x.setid}</span>
                    </label>
                  ))
                )}
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelBtn} onClick={() => setAddToStoreModalOpen(false)}>취소</button>
                <button type="button" className={styles.modalConfirmBtn} onClick={handleAddToStoreConfirm}>
                  저장 ({selectedSetIdsForAdd.size}개)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
