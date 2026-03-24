import { useState, useEffect, useCallback } from 'react';
import { getPhrases, createPhrase, updatePhrase, deletePhrase } from '../services/phrases';
import type { Phrase } from '../services/phrases';
import { getApiBaseUrl } from '../services/api';
import * as lnms from '../services/lnmsApi';
import { showCustomAlert } from './CustomAlert';
import { showCustomConfirm } from './CustomConfirm';
import { showCustomPrompt } from './CustomPrompt';
import PhraseModal from './PhraseModal';
import SerialPortModal from './SerialPortModal';
import BellAddModal from './BellAddModal';
import '../styles/SettingsView.css';

/** 에이전트: 로그인 성공 시 저장 → 다음부터 자동 로그인 */
const LNSMS_AGENT_AUTO_LOGIN_KEY = 'lnsms_agent_auto_login';

type SavedAgentLogin = { userid: string; userpw: string };

function loadSavedAgentLogin(): SavedAgentLogin | null {
  try {
    const raw = localStorage.getItem(LNSMS_AGENT_AUTO_LOGIN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.userid === 'string' && typeof o.userpw === 'string' && o.userid.trim()) {
      return { userid: o.userid.trim(), userpw: o.userpw };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveAgentAutoLogin(userid: string, userpw: string) {
  try {
    localStorage.setItem(LNSMS_AGENT_AUTO_LOGIN_KEY, JSON.stringify({ userid: userid.trim(), userpw }));
  } catch {
    /* ignore */
  }
}

function clearAgentAutoLogin() {
  try {
    localStorage.removeItem(LNSMS_AGENT_AUTO_LOGIN_KEY);
  } catch {
    /* ignore */
  }
}

interface SettingsTransferModalProps {
  mode: 'download' | 'upload';
  onClose: () => void;
  onDownloadApply: (setid: string) => Promise<void>;
  onUploadSave: (setid: string, isNew: boolean, config: { phrases: unknown[]; serial: { ports: unknown[] }; remoteControl?: { buttons: unknown[] } }) => Promise<void>;
  currentConfig?: { phrases: unknown[]; serial: { ports: unknown[] }; remoteControl?: { buttons: unknown[] } } | null;
  /** 다운로드 시: 지정 시 해당 매장에 연결된 세트ID만 표시 */
  storeid?: string | null;
  /** 업로드 시 신규 세트 생성에 사용할 userid */
  userid?: string | null;
}

function SettingsTransferModal({
  mode,
  onClose,
  onDownloadApply,
  onUploadSave,
  currentConfig,
  storeid,
  userid,
}: SettingsTransferModalProps) {
  const [loading, setLoading] = useState(false);
  const [setList, setSetList] = useState<lnms.SetItem[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [newSetId, setNewSetId] = useState('');
  const [useNewSet, setUseNewSet] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetchError('');
      try {
        if (mode === 'download' && storeid) {
          const store = await lnms.lnmsGetStore(storeid);
          if (!cancelled) setSetList((store.setids || []).map(sid => ({ setid: sid })));
        } else {
          const list = await lnms.lnmsListSets(userid || undefined, {
            useRemote: mode === 'upload',
          });
          if (!cancelled) setSetList(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : '목록 조회 실패');
      }
    })();
    return () => { cancelled = true; };
  }, [mode, storeid, userid]);

  const handleConfirm = async () => {
    if (mode === 'download') {
      if (!selectedSetId) {
        await showCustomAlert('세트를 선택하세요.');
        return;
      }
      setLoading(true);
      try {
        await onDownloadApply(selectedSetId);
        onClose();
      } catch (e) {
        await showCustomAlert(e instanceof Error ? e.message : '다운로드 적용 실패');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (mode === 'upload') {
      const setid = useNewSet ? newSetId.trim() : selectedSetId;
      if (!setid) {
        await showCustomAlert(useNewSet ? '신규 세트 ID를 입력하세요.' : '세트를 선택하세요.');
        return;
      }
      if (!currentConfig) {
        await showCustomAlert('현재 설정을 불러올 수 없습니다.');
        return;
      }
      if (useNewSet && !userid) {
        await showCustomAlert('업로드하려면 먼저 로그인하세요.');
        return;
      }
      const overwrite = !useNewSet && setList.some(s => s.setid === setid);
      if (overwrite) {
        const ok = await showCustomConfirm('덮어쓰면 해당 세트의 기존 설정이 사라집니다. 진행할까요?');
        if (!ok) return;
      }
      setLoading(true);
      try {
        await onUploadSave(setid, useNewSet, currentConfig);
        onClose();
      } catch (e) {
        await showCustomAlert(e instanceof Error ? e.message : '업로드 실패');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-transfer-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'download' ? '설정 다운로드' : '설정 업로드'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-form">
          {fetchError && <p className="transfer-warning">{fetchError}</p>}
          {mode === 'download' && (
            <>
              <p className="transfer-hint">
                {storeid ? '선택한 매장에 연결된 세트만 표시됩니다. 세트를 선택하면 해당 설정으로 PC에 적용됩니다.' : '세트를 선택하면 해당 세트 설정으로 현재 에이전트가 덮어씌워집니다.'}
              </p>
              <div className="form-group">
                <label>세트 선택</label>
                <select value={selectedSetId} onChange={e => setSelectedSetId(e.target.value)}>
                  <option value="">선택</option>
                  {setList.map(s => (
                    <option key={s.setid} value={s.setid}>{s.setid}{s.userid ? ` (${s.userid})` : ''}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {mode === 'upload' && (
            <>
              <p className="transfer-hint">기존 세트를 선택하거나 신규 세트 ID로 업로드할 수 있습니다. (신규는 로그인 필요)</p>
              <p className="transfer-warning">⚠️ 덮어쓰면 해당 세트의 기존 설정이 사라집니다.</p>
              <div className="form-group">
                <label>
                  <input type="radio" checked={!useNewSet} onChange={() => setUseNewSet(false)} />
                  기존 세트 선택
                </label>
                <select value={selectedSetId} onChange={e => setSelectedSetId(e.target.value)} disabled={useNewSet}>
                  <option value="">선택</option>
                  {setList.map(s => (
                    <option key={s.setid} value={s.setid}>{s.setid}{s.userid ? ` (${s.userid})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input type="radio" checked={useNewSet} onChange={() => setUseNewSet(true)} />
                  신규 세트 추가
                </label>
                <input
                  type="text"
                  value={newSetId}
                  onChange={e => setNewSetId(e.target.value)}
                  placeholder="세트 ID"
                  disabled={!useNewSet}
                />
              </div>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>취소</button>
            <button type="button" className="save-button" onClick={handleConfirm} disabled={loading}>
              {mode === 'download' ? '다운로드' : '업로드'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsViewProps {
  onNavigateBack: () => void;
}

type RemoteButton = {
  number: number; // 1..15
  name: string;
  sendCode: string;
};

function SettingsView({ onNavigateBack }: SettingsViewProps) {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase | null>(null);
  const [isPhraseModalOpen, setIsPhraseModalOpen] = useState(false);
  const [phraseModalMode, setPhraseModalMode] = useState<'add' | 'edit'>('edit');
  const [isSerialPortModalOpen, setIsSerialPortModalOpen] = useState(false);
  const [isBellAddModalOpen, setIsBellAddModalOpen] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [currentPhraseForBell, setCurrentPhraseForBell] = useState<Phrase | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storesForUser, setStoresForUser] = useState<lnms.StoreInfo[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadConfig, setUploadConfig] = useState<{ phrases: unknown[]; serial: { ports: unknown[] }; remoteControl?: { buttons: unknown[] } } | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [remoteButtons, setRemoteButtons] = useState<RemoteButton[]>([]);

  const completeLogin = useCallback(async (uid: string, clearPwField: boolean) => {
    setIsLoggedIn(true);
    setLoginId(uid);
    if (clearPwField) setLoginPw('');
    setShowLoginModal(false);
    try {
      const list = await lnms.lnmsGetStores(uid.trim());
      const arr = Array.isArray(list) ? list : [];
      setStoresForUser(arr);
      setSelectedStoreId((prev) => {
        if (arr.length === 0) return null;
        if (prev && arr.some((s) => s.storeid === prev)) return prev;
        return arr[0].storeid;
      });
    } catch {
      setStoresForUser([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = loadSavedAgentLogin();
      if (!saved) return;
      try {
        const ok = await lnms.lnmsLogin(saved.userid, saved.userpw);
        if (cancelled) return;
        if (ok.success) {
          await completeLogin(saved.userid, true);
        } else {
          clearAgentAutoLogin();
        }
      } catch {
        if (!cancelled) clearAgentAutoLogin();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completeLogin]);

  useEffect(() => {
    loadPhrases();
    loadTTSEnabled();
    loadActiveSetId();
    loadRemoteButtons();
  }, []);

  const loadActiveSetId = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/settingsapply/active-setid`);
      if (res.ok) {
        const data = await res.json();
        const id = data?.activeSetId?.trim();
        setActiveSetId(id || null);
        return id || null;
      }
    } catch {
      setActiveSetId(null);
    }
    return null;
  };

  useEffect(() => {
    (async () => {
      try {
        const apiUrl = await getApiBaseUrl();
        const setid = await loadActiveSetId();
        await lnms.lnmsRegisterAgent(`${apiUrl.replace(/\/$/, '')}/api/broadcast/receive`, setid || undefined, undefined);
      } catch {
        // lnms 서버 미동작 시 무시
      }
    })();
  }, []);

  const normalizeRemoteButtons = (data: any): RemoteButton[] => {
    const raw = data?.buttons ?? data?.Buttons ?? [];
    if (!Array.isArray(raw)) return Array.from({ length: 15 }, (_, i) => ({ number: i + 1, name: '', sendCode: '' }));
    const map = new Map<number, RemoteButton>();
    for (const item of raw) {
      const n = Number(item?.number ?? item?.Number);
      if (!Number.isFinite(n) || n < 1 || n > 15) continue;
      map.set(n, {
        number: n,
        name: String(item?.name ?? item?.Name ?? ''),
        sendCode: String(item?.sendCode ?? item?.SendCode ?? ''),
      });
    }
    return Array.from({ length: 15 }, (_, i) => map.get(i + 1) ?? ({ number: i + 1, name: '', sendCode: '' }));
  };

  const loadRemoteButtons = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/remotecontrol/buttons`);
      if (!res.ok) throw new Error('리모콘 설정 로드 실패');
      const data = await res.json();
      setRemoteButtons(normalizeRemoteButtons(data));
    } catch (e) {
      console.error(e);
      setRemoteButtons(Array.from({ length: 15 }, (_, i) => ({ number: i + 1, name: '', sendCode: '' })));
    }
  };

  const saveRemoteButtons = async (nextButtons: RemoteButton[]) => {
    const apiUrl = await getApiBaseUrl();
    const body = { buttons: nextButtons.map(b => ({ number: b.number, name: b.name, sendCode: b.sendCode })) };
    const res = await fetch(`${apiUrl}/api/remotecontrol/buttons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('리모콘 설정 저장 실패');
    const data = await res.json();
    const saved = data?.settings ?? data?.Settings ?? body;
    setRemoteButtons(normalizeRemoteButtons(saved));
  };

  const handleRemoteNameBlurSave = async () => {
    try {
      await saveRemoteButtons(remoteButtons);
    } catch (e) {
      console.error(e);
      await showCustomAlert('리모콘 이름 저장에 실패했습니다.');
      // 필요하면 서버 값을 다시 로드
      await loadRemoteButtons();
    }
  };

  const handleRemoteEditCode = async (number: number) => {
    const current = remoteButtons.find(b => b.number === number);
    const next = await showCustomPrompt({
      title: `리모콘 ${number}번 발송코드`,
      message: '시리얼로 그대로 송신합니다. (\\r은 자동으로 붙습니다)',
      placeholder: '예) 26020011.bell=123',
      defaultValue: current?.sendCode ?? '',
    });
    if (next == null) return;
    const updated = remoteButtons.map(b => (b.number === number ? { ...b, sendCode: next } : b));
    setRemoteButtons(updated);
    try {
      await saveRemoteButtons(updated);
    } catch (e) {
      console.error(e);
      await showCustomAlert('발송코드 저장에 실패했습니다.');
      await loadRemoteButtons();
    }
  };

  const handleRemoteTestSend = async (number: number) => {
    try {
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/remotecontrol/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message ?? data?.Message ?? '송신 실패';
        throw new Error(msg);
      }
      await showCustomAlert(`테스트 송신 완료 (포트: ${data?.portName ?? data?.PortName ?? ''})`);
    } catch (e) {
      console.error(e);
      await showCustomAlert(e instanceof Error ? e.message : '테스트 송신 실패');
    }
  };

  const loadTTSEnabled = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/tts/enabled`);
      if (response.ok) {
        const data = await response.json();
        setTtsEnabled(data.enabled ?? true);
      }
    } catch (error) {
      console.error('TTS 설정 로드 실패:', error);
    }
  };

  const handleToggleTTS = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const newValue = !ttsEnabled;
      const response = await fetch(`${apiUrl}/api/tts/enabled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newValue),
      });
      if (response.ok) {
        setTtsEnabled(newValue);
      }
    } catch (error) {
      console.error('TTS 설정 변경 실패:', error);
    }
  };

  const loadPhrases = async () => {
    try {
      const data = await getPhrases();
      setPhrases(data.Phrases || []);
    } catch (error) {
      console.error('문구 로드 실패:', error);
    }
  };

  const handleAddPhrase = async () => {
    try {
      // uid를 먼저 생성(서버)하고, 문구는 빈칸으로 시작
      const created = await createPhrase({
        text: '',
        isEnabled: true,
        color: '#000000',
        bellCodes: []
      });

      // 생성된 uid로 바로 모달을 열어 벨등록 가능하게 함
      setSelectedPhrase(created);
      setPhraseModalMode('add');
      setIsPhraseModalOpen(true);

      // 목록에도 즉시 반영
      await loadPhrases();
    } catch (error) {
      console.error('문구(빈칸) 생성 실패:', error);
      await showCustomAlert('문구 추가에 실패했습니다.');
    }
  };

  const handleEditPhrase = (phrase: Phrase) => {
    setSelectedPhrase(phrase);
    setPhraseModalMode('edit');
    setIsPhraseModalOpen(true);
  };

  const handleDeletePhrase = async (uid: string) => {
    const phrase = phrases.find(p => p.uid === uid);
    
    // 기본 문구("crcv.assist" 벨코드)는 삭제 불가
    const defaultBellCode = "crcv.assist";
    const isDefaultPhrase = phrase?.bellCodes?.some(code => 
      code?.toLowerCase().trim() === defaultBellCode
    );
    
    if (isDefaultPhrase) {
      await showCustomAlert('불가능 합니다.');
      return;
    }
    
    const confirmed = await showCustomConfirm('이 문구를 삭제하시겠습니까?');
    if (confirmed) {
      try {
        await deletePhrase(uid);
        await loadPhrases();
      } catch (error: any) {
        console.error('문구 삭제 실패:', error);
        // 백엔드에서도 체크하므로 에러 메시지 표시
        const errorMessage = error?.response?.data?.error || '문구 삭제에 실패했습니다.';
        await showCustomAlert(errorMessage);
      }
    }
  };

  const handlePhraseSave = async (phraseData: Partial<Phrase>) => {
    try {
      // 최신 데이터 가져오기
      const allPhrases = await getPhrases();
      const currentPhrase = selectedPhrase 
        ? allPhrases.Phrases.find(p => p.uid === selectedPhrase.uid)
        : null;

      // 벨 코드는 최신 데이터 사용 (벨 등록 모달에서 추가된 벨 코드 반영)
      const phraseDataToSave = {
        ...phraseData,
        bellCodes: currentPhrase?.bellCodes || phraseData.bellCodes || []
      };

      if (selectedPhrase) {
        await updatePhrase(selectedPhrase.uid, phraseDataToSave);
      } else {
        await createPhrase(phraseDataToSave);
      }
      setIsPhraseModalOpen(false);
      setSelectedPhrase(null);
      await loadPhrases();
    } catch (error) {
      console.error('문구 저장 실패:', error);
      await showCustomAlert('문구 저장에 실패했습니다.');
    }
  };

  const handleBellAdd = async (bellCode: string) => {
    if (!currentPhraseForBell) return;
    
    const normalizedBellCode = bellCode.toLowerCase().trim();
    const defaultBellCode = "crcv.assist";
    const defaultUid = "90000001";
    
    // 기본 벨 코드는 기본 문구에만 할당 가능
    if (normalizedBellCode === defaultBellCode && currentPhraseForBell.uid !== defaultUid) {
      await showCustomAlert('기본 벨 코드(crcv.assist)는 기본 문구에만 할당할 수 있습니다.');
      return;
    }
    
    const allPhrases = await getPhrases();
    const currentPhrase = allPhrases.Phrases.find(p => p.uid === currentPhraseForBell.uid);
    
    if (!currentPhrase) {
      console.error('현재 문구를 찾을 수 없습니다.');
      return;
    }
    
    // 다른 문구에서 동일한 벨 코드 제거 (기본 벨 코드는 제외)
    const otherPhrases = allPhrases.Phrases.filter(p => p.uid !== currentPhrase.uid);
    for (const phrase of otherPhrases) {
      if (phrase.bellCodes?.some(c => c?.toLowerCase().trim() === normalizedBellCode)) {
        await updatePhrase(phrase.uid, {
          ...phrase,
          bellCodes: phrase.bellCodes.filter(c => c?.toLowerCase().trim() !== normalizedBellCode)
        });
      }
    }

    // 현재 문구에 벨 코드 추가
    const currentBellCodes = currentPhrase.bellCodes || [];
    if (!currentBellCodes.some(c => c?.toLowerCase().trim() === normalizedBellCode)) {
      await updatePhrase(currentPhrase.uid, {
        ...currentPhrase,
        bellCodes: [...currentBellCodes, normalizedBellCode]
      });
      
      // JSON에서 최신 데이터 다시 읽어서 갱신
      await loadPhrases();
      const updatedPhrases = await getPhrases();
      const updatedPhrase = updatedPhrases.Phrases.find(p => p.uid === currentPhrase.uid);
      
      if (updatedPhrase) {
        // 벨 등록 모달용 상태 업데이트
        setCurrentPhraseForBell(updatedPhrase);
        
        // 문구 수정 모달이 열려있으면 selectedPhrase도 업데이트하여 벨 개수 즉시 반영
        if (selectedPhrase && selectedPhrase.uid === updatedPhrase.uid) {
          setSelectedPhrase(updatedPhrase);
        }
      }
    }
  };

  const handleBellAddClick = (phrase: Phrase) => {
    setCurrentPhraseForBell(phrase);
    setIsBellAddModalOpen(true);
  };

  const handleBellRemoveAll = async () => {
    if (!selectedPhrase) return;
    
    const confirmed = await showCustomConfirm('등록된 모든 벨을 삭제하시겠습니까?');
    if (confirmed) {
      try {
        const allPhrases = await getPhrases();
        const currentPhrase = allPhrases.Phrases.find(p => p.uid === selectedPhrase.uid);
        if (!currentPhrase) {
          console.error('현재 문구를 찾을 수 없습니다.');
          return;
        }

        await updatePhrase(currentPhrase.uid, {
          text: currentPhrase.text,
          isEnabled: currentPhrase.isEnabled,
          color: currentPhrase.color,
          bellCodes: []
        });
        
        await loadPhrases();
        
        // 모달의 선택된 문구도 업데이트
        const updatedPhrases = await getPhrases();
        const updatedPhrase = updatedPhrases.Phrases.find(p => p.uid === selectedPhrase.uid);
        if (updatedPhrase) {
          setSelectedPhrase(updatedPhrase);
        }
      } catch (error) {
        console.error('벨 코드 전체 삭제 실패:', error);
        await showCustomAlert('벨 코드 전체 삭제에 실패했습니다.');
      }
    }
  };

  const handleNotificationTest = async (phrase: Phrase) => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // uid 기반 테스트 (벨 등록 전이어도 테스트 가능)
        body: JSON.stringify({ uid: phrase.uid }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        await showCustomAlert(`알림 테스트 실패: ${errorData.error || '알 수 없는 오류'}`);
        return;
      }
      
      // 알림 테스트 성공 시 알림 페이지로 전환 (뒤로가기처럼)
      onNavigateBack();
    } catch (error: any) {
      console.error('알림 테스트 실패:', error);
      await showCustomAlert(`알림 테스트 실패: ${error.message}`);
    }
  };

  const handleClose = async () => {
    // 창 닫기 API 호출
    try {
      const apiUrl = await getApiBaseUrl();
      await fetch(`${apiUrl}/api/window/hide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('창 닫기 실패:', error);
    }
  };

  const handleTTSTestClick = async (phrase: Phrase) => {
    if (!phrase.text?.trim()) {
      await showCustomAlert('테스트할 문구가 없습니다.');
      return;
    }

    try {
      const apiUrl = await getApiBaseUrl();
      // TTS 활성화 상태 확인
      const ttsResponse = await fetch(`${apiUrl}/api/tts/enabled`);
      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        if (!ttsData.enabled) {
          await showCustomAlert('TTS가 비활성화되어 있습니다.');
          return;
        }
      }

      // TTS 재생
      const response = await fetch(`${apiUrl}/api/tts/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: phrase.text }),
      });

      if (!response.ok) {
        throw new Error('TTS 재생 실패');
      }
    } catch (error) {
      console.error('TTS 테스트 실패:', error);
      await showCustomAlert('TTS 재생에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (!showLoginModal || !loginId.trim()) {
      setStoresForUser([]);
      return;
    }
    let cancelled = false;
    lnms.lnmsGetStores(loginId.trim()).then(list => {
      if (!cancelled) setStoresForUser(Array.isArray(list) ? list : []);
    }).catch(() => { if (!cancelled) setStoresForUser([]); });
    return () => { cancelled = true; };
  }, [showLoginModal, loginId]);

  const handleLoginSubmit = async () => {
    const uid = loginId.trim();
    const pw = loginPw;
    if (!uid || !pw) {
      await showCustomAlert('아이디와 비밀번호를 입력하세요.');
      return;
    }
    try {
      const ok = await lnms.lnmsLogin(uid, pw);
      if (ok.success) {
        saveAgentAutoLogin(uid, pw);
        await completeLogin(uid, true);
      } else {
        await showCustomAlert('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch {
      await showCustomAlert('로그인 요청에 실패했습니다.');
    }
  };

  const handleLogout = () => {
    clearAgentAutoLogin();
    setIsLoggedIn(false);
    setSelectedStoreId(null);
    setStoresForUser([]);
    setLoginId('');
    setLoginPw('');
  };

  const handleDownloadSettings = () => {
    if (!isLoggedIn) {
      void showCustomAlert('먼저 로그인하세요.');
      return;
    }
    setShowDownloadModal(true);
  };

  const handleBroadcast = async (phrase: Phrase) => {
    const code = phrase.bellCodes?.[0]?.trim();
    if (!code) {
      await showCustomAlert('이 문구에 등록된 벨이 없습니다. 벨 등록 후 브로드캐스트할 수 있습니다.');
      return;
    }
    try {
      await lnms.lnmsBroadcast(code);
      await showCustomAlert(`"${code}" 브로드캐스트를 요청했습니다. 등록된 모든 매장에 RX가 전파됩니다.`);
    } catch (e) {
      await showCustomAlert(e instanceof Error ? e.message : '브로드캐스트 요청 실패');
    }
  };

  const handleUploadSettings = async () => {
    if (!isLoggedIn) {
      await showCustomAlert('먼저 로그인하세요.');
      return;
    }
    try {
      const apiUrl = await getApiBaseUrl();
      const [phrasesRes, serialRes, remoteRes] = await Promise.all([
        fetch(`${apiUrl}/api/phrases`),
        fetch(`${apiUrl}/api/serialport/settings`),
        fetch(`${apiUrl}/api/remotecontrol/buttons`),
      ]);
      if (!phrasesRes.ok || !serialRes.ok || !remoteRes.ok) throw new Error('설정 조회 실패');
      const phrasesData = await phrasesRes.json();
      const serialData = await serialRes.json();
      const remoteData = await remoteRes.json();
      setUploadConfig({
        phrases: phrasesData.phrases || [],
        serial: { ports: serialData.ports || [] },
        remoteControl: { buttons: remoteData.buttons || [] },
      });
      setShowUploadModal(true);
    } catch (e) {
      await showCustomAlert(e instanceof Error ? e.message : '현재 설정을 불러오지 못했습니다.');
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-appbar">
        <div className="appbar-left">
          <span className="appbar-title">에이전트 설정</span>
          {activeSetId && (
            <span className="appbar-active-setid" title="COM RX 시 이 세트 설정 기준으로 알림">세트: {activeSetId}</span>
          )}
        </div>
        <div className="appbar-actions">
          {isLoggedIn ? (
            <button type="button" className="appbar-btn" onClick={handleLogout}>로그아웃</button>
          ) : (
            <button type="button" className="appbar-btn" onClick={() => setShowLoginModal(true)}>로그인</button>
          )}
          <button
            type="button"
            className="appbar-btn"
            onClick={handleDownloadSettings}
            disabled={!isLoggedIn}
            title={isLoggedIn ? undefined : '로그인 후 사용할 수 있습니다.'}
          >
            설정 서버에서 받기
          </button>
          <button
            type="button"
            className="appbar-btn"
            onClick={handleUploadSettings}
            disabled={!isLoggedIn}
            title={isLoggedIn ? undefined : '로그인 후 사용할 수 있습니다.'}
          >
            설정 서버에 저장
          </button>
        </div>
      </div>

      <div className="settings-header">
        <button className="back-button" onClick={onNavigateBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>기능 설정</h1>
        <div className="header-actions">
          <button 
            className="serial-port-button"
            onClick={() => setIsSerialPortModalOpen(true)}
            title="시리얼 포트 설정"
          >
            시리얼포트 설정
          </button>
          <label className="tts-toggle-label">
            <span>TTS</span>
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={handleToggleTTS}
              className="tts-toggle-switch"
            />
          </label>
          <button 
            className="close-button"
            onClick={handleClose}
            title="닫기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="section-header">
            <h2>문구 관리</h2>
            <button className="add-button" onClick={handleAddPhrase}>
              + 문구 추가
            </button>
          </div>

          <div className="phrases-list">
            {phrases.length === 0 ? (
              <div className="empty-state">
                <p>등록된 문구가 없습니다.</p>
                <button className="add-button" onClick={handleAddPhrase}>
                  첫 문구 추가하기
                </button>
              </div>
            ) : (
              phrases.map((phrase) => (
                <div key={phrase.uid || phrase.id} className="phrase-item">
                  <div className="phrase-content">
                    <div className="phrase-text">{phrase.text}</div>
                    <div className="phrase-meta">
                      <span className={`phrase-status ${phrase.isEnabled ? 'enabled' : 'disabled'}`}>
                        {phrase.isEnabled ? '활성' : '비활성'}
                      </span>
                      <span className="phrase-bell-codes">
                        벨 {phrase.bellCodes?.length || 0}개
                      </span>
                    </div>
                  </div>
                  <div className="phrase-actions">
                    {(() => {
                      const defaultBellCode = "crcv.assist";
                      const isDefaultPhrase = phrase.bellCodes?.some(code => 
                        code?.toLowerCase().trim() === defaultBellCode
                      );
                      
                      if (!isDefaultPhrase) {
                        // 기본 문구가 아닌 경우에만 벨 등록 버튼 표시
                        return (
                          <button 
                            className="bell-add-button"
                            onClick={() => handleBellAddClick(phrase)}
                            title="벨 등록"
                          >
                            벨 등록
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button 
                      className="notification-test-button"
                      onClick={() => handleNotificationTest(phrase)}
                      title="알림 테스트"
                    >
                      알림테스트
                    </button>
                    <button 
                      className="tts-test-button"
                      onClick={() => handleTTSTestClick(phrase)}
                      title="TTS 테스트"
                    >
                      TTS테스트
                    </button>
                    <button
                      type="button"
                      className="broadcast-button"
                      onClick={() => handleBroadcast(phrase)}
                      title="서버로 브로드캐스팅 (모든 매장에 RX 전파)"
                    >
                      브로드캐스트
                    </button>
                    <button 
                      className="edit-button"
                      onClick={() => handleEditPhrase(phrase)}
                    >
                      수정
                    </button>
                    {(() => {
                      const defaultBellCode = "crcv.assist";
                      const isDefaultPhrase = phrase.bellCodes?.some(code => 
                        code?.toLowerCase().trim() === defaultBellCode
                      );
                      
                      if (isDefaultPhrase) {
                        // 기본 문구는 삭제 버튼만 숨김
                        return null;
                      }
                      
                      return (
                        <button 
                          className="delete-button"
                          onClick={() => handleDeletePhrase(phrase.uid)}
                        >
                          삭제
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="settings-section remote-section">
          <div className="section-header">
            <h2>리모콘 설정 (1~15)</h2>
          </div>
          <div className="remote-list">
            {remoteButtons.map((b) => (
              <div key={b.number} className="remote-item">
                <div className="remote-left">
                  <div className="remote-number">{b.number}</div>
                  <input
                    className="remote-name"
                    type="text"
                    value={b.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRemoteButtons(prev => prev.map(x => (x.number === b.number ? { ...x, name: v } : x)));
                    }}
                    onBlur={() => handleRemoteNameBlurSave()}
                    placeholder="이름"
                  />
                </div>
                <div className="remote-code" title={b.sendCode || ''}>
                  {b.sendCode ? b.sendCode : <span className="remote-code-empty">발송코드 없음</span>}
                </div>
                <div className="remote-actions">
                  <button className="edit-button" type="button" onClick={() => handleRemoteEditCode(b.number)}>
                    발송코드 편집
                  </button>
                  <button className="notification-test-button" type="button" onClick={() => handleRemoteTestSend(b.number)}>
                    테스트 송신
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isPhraseModalOpen && (
        <PhraseModal
          mode={phraseModalMode}
          phrase={selectedPhrase}
          onSave={handlePhraseSave}
          onClose={() => {
            setIsPhraseModalOpen(false);
            setSelectedPhrase(null);
            setPhraseModalMode('edit');
          }}
          onBellAdd={() => {
            if (selectedPhrase) {
              handleBellAddClick(selectedPhrase);
            }
          }}
          onBellRemoveAll={handleBellRemoveAll}
        />
      )}

      {isSerialPortModalOpen && (
        <SerialPortModal
          onClose={() => setIsSerialPortModalOpen(false)}
        />
      )}

      {isBellAddModalOpen && currentPhraseForBell && (
        <BellAddModal
          onAdd={(bellCode) => {
            handleBellAdd(bellCode);
          }}
          onClose={async () => {
            setIsBellAddModalOpen(false);
            setCurrentPhraseForBell(null);
            await loadPhrases();
          }}
        />
      )}

      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content settings-login-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>로그인</h2>
              <button className="modal-close" onClick={() => setShowLoginModal(false)}>×</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>아이디</label>
                <input
                  type="text"
                  value={loginId}
                  onChange={e => { setLoginId(e.target.value); setSelectedStoreId(null); }}
                  placeholder="admin"
                />
              </div>
              <div className="form-group">
                <label>비밀번호</label>
                <input
                  type="password"
                  value={loginPw}
                  onChange={e => setLoginPw(e.target.value)}
                  placeholder="admin"
                />
              </div>
              {storesForUser.length > 0 && (
                <div className="form-group">
                  <label>매장 선택 (세트 내려받기 시 사용)</label>
                  <select
                    value={selectedStoreId ?? ''}
                    onChange={e => setSelectedStoreId(e.target.value || null)}
                  >
                    <option value="">선택</option>
                    {storesForUser.map(s => (
                      <option key={s.storeid} value={s.storeid}>{s.storeid}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowLoginModal(false)}>취소</button>
                <button type="button" className="save-button" onClick={handleLoginSubmit}>로그인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDownloadModal && (
        <SettingsTransferModal
          mode="download"
          storeid={selectedStoreId ?? undefined}
          userid={loginId.trim() || undefined}
          onClose={() => setShowDownloadModal(false)}
          onDownloadApply={async (setid) => {
            const config = await lnms.lnmsGetSetConfig(setid, loginId.trim() || undefined);
            const apiUrl = await getApiBaseUrl();
            const res = await fetch(`${apiUrl}/api/settingsapply`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                setid,
                phrases: config.phrases,
                serial: config.serial,
                remoteControl: config.remoteControl || { buttons: [] }
              }),
            });
            if (!res.ok) throw new Error('설정 적용 실패');
            await loadPhrases();
            await loadActiveSetId();
            await loadRemoteButtons();
            try {
              await lnms.lnmsRegisterAgent(`${apiUrl.replace(/\/$/, '')}/api/broadcast/receive`, setid, selectedStoreId ?? undefined);
            } catch {
              // 브로드캐스트 수신용 등록 실패는 무시
            }
            await showCustomAlert(`세트 "${setid}" 설정을 적용했습니다. COM RX는 이 세트 기준으로 알림됩니다.`);
          }}
          onUploadSave={async () => {}}
        />
      )}

      {showUploadModal && uploadConfig && (
        <SettingsTransferModal
          mode="upload"
          userid={loginId.trim() || undefined}
          onClose={() => { setShowUploadModal(false); setUploadConfig(null); }}
          onDownloadApply={async () => {}}
          onUploadSave={async (setid, isNew) => {
            if (isNew && loginId.trim()) await lnms.lnmsCreateSet(setid, loginId.trim());
            const phrases = (uploadConfig.phrases ?? []).map((p) => {
              const obj = (p ?? {}) as Record<string, unknown>;
              const rawImg = obj.image ?? obj.imageUrl;
              const img =
                typeof rawImg === 'string'
                  ? rawImg.replace(/^.*[/\\]/, '')
                  : null;
              return { ...obj, image: img };
            });
            await lnms.lnmsSaveSetConfig(
              setid,
              {
                phrases,
                serial: uploadConfig.serial ?? { ports: [] },
                remoteControl: uploadConfig.remoteControl ?? { buttons: [] }
              },
              loginId.trim() || undefined
            );
            await showCustomAlert(`세트 "${setid}"로 업로드했습니다.`);
          }}
          currentConfig={uploadConfig}
        />
      )}
    </div>
  );
}

export default SettingsView;

