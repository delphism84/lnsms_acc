import { useState, useEffect, useRef } from 'react';
import { getBackendUrl } from '../services/phrases';
import { getApiBaseUrl } from '../services/api';
import { showCustomAlert } from './CustomAlert';
import { showCustomPrompt } from './CustomPrompt';
import * as lnms from '../services/lnmsApi';
import '../styles/NotificationView.css';

function remoteControlForSettingsApply(rc: unknown): { remoteControl?: { remotes: unknown[] } } {
  if (!rc || typeof rc !== 'object') return {};
  const remotes = (rc as { remotes?: unknown }).remotes;
  if (Array.isArray(remotes)) return { remoteControl: { remotes } };
  return {};
}

interface NotificationViewProps {
  onNavigateToSettings: () => void;
}

interface UidNotification {
  uid: string;
  message: string;
  color: string;
  autoCloseEnabled?: boolean;
  autoCloseSeconds?: number;
  imageUrl?: string | null;
}

type RemoteEntry = {
  id: string;
  name: string;
  bellCode: string;
  enabled: boolean;
};

function NotificationView({ onNavigateToSettings }: NotificationViewProps) {
  // BE가 관리하는 uid 맵을 그대로 표시 (현재 1건 + 대기 건수)
  const [activeNotifications, setActiveNotifications] = useState<UidNotification[]>([]);
  const [queueLength, setQueueLength] = useState(0);
  const lastTtsUidsRef = useRef<Set<string>>(new Set());
  const autoCloseTimerRef = useRef<number | null>(null);
  const [notificationTitle, setNotificationTitle] = useState('장애인 도움 요청');
  const [systemNotifyCallTelText, setSystemNotifyCallTelText] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [storesForUser, setStoresForUser] = useState<lnms.StoreInfo[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadSetList, setDownloadSetList] = useState<string[]>([]);
  const [selectedDownloadSetId, setSelectedDownloadSetId] = useState('');
  const [systemAccessPassword, setSystemAccessPassword] = useState('8206');
  const [showRemotePad, setShowRemotePad] = useState(false);
  const [remotes, setRemotes] = useState<RemoteEntry[]>([]);
  const [remoteSendingKey, setRemoteSendingKey] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'ok' | 'error'>('ok');

  const AUTO_LOGIN_KEY = 'lnsms_agent_auto_login';

  useEffect(() => {
    const connectSignalR = async () => {
      try {
        const backendUrl = await getBackendUrl();
        const apiUrl = await getApiBaseUrl();

        // 런타임 타이틀(알림 화면 타이틀)
        try {
          const r = await fetch(`${apiUrl}/api/settings/app`, { signal: AbortSignal.timeout(1000) });
          if (r.ok) {
            const cfg = await r.json();
            if (cfg?.notificationTitle) {
              setNotificationTitle(String(cfg.notificationTitle));
            }
            if (typeof cfg?.systemNotifyCallTelText === 'string') {
              setSystemNotifyCallTelText(cfg.systemNotifyCallTelText);
            }
            if (typeof cfg?.systemAccessPassword === 'string' && cfg.systemAccessPassword.trim()) {
              setSystemAccessPassword(cfg.systemAccessPassword.trim());
            }
          }
        } catch {
          // ignore
        }

        // SignalR 연결 (간단한 폴링 방식으로 구현)
        // 실제 SignalR 라이브러리 사용 시 @microsoft/signalr 패키지 필요
        const checkNotifications = async () => {
          try {
            const response = await fetch(`${backendUrl}/api/notifications/active`);
            if (response.ok) {
              const data = await response.json();
              const list: UidNotification[] = (data?.notifications ?? [])
                .filter((n: any) => n?.uid)
                .map((n: any) => ({
                  uid: String(n.uid),
                  message: String(n.message ?? ''),
                  color: String(n.color ?? '#FFFFFF'),
                  autoCloseEnabled: Boolean(n.autoCloseEnabled),
                  autoCloseSeconds: Number(n.autoCloseSeconds ?? 10),
                  imageUrl: n.imageUrl == null ? null : String(n.imageUrl),
                }));
              setQueueLength(Number(data?.queueLength ?? 0));

              // 신규 uid에 대해서만 1회 TTS (중복 재생 방지)
              list.forEach(n => {
                if (!lastTtsUidsRef.current.has(n.uid)) {
                  lastTtsUidsRef.current.add(n.uid);
                  if (n.message.trim()) {
                    playTTS(n.message);
                  }
                }
              });

              if (list.length === 0) {
                lastTtsUidsRef.current.clear();
              }

              setActiveNotifications(list);
            }
          } catch (error) {
            console.error('알림 확인 실패:', error);
          }
        };

        // 초기 연결 확인
        await checkNotifications();

        // 주기적으로 알림 확인 (여러 벨 동시 수신을 위해 짧은 간격)
        const interval = setInterval(checkNotifications, 500);

        return () => {
          clearInterval(interval);
        };
      } catch (error) {
        console.error('SignalR 연결 실패:', error);
      }
    };

    connectSignalR();

    return () => {
      // 정리
    };
  }, []);

  useEffect(() => {
    const loadRemotes = async () => {
      try {
        const apiUrl = await getApiBaseUrl();
        const res = await fetch(`${apiUrl}/api/remotecontrol/buttons`);
        if (!res.ok) return;
        const data = await res.json();
        const raw = Array.isArray(data?.remotes) ? data.remotes : [];
        const list: RemoteEntry[] = raw.map((r: any, i: number) => ({
          id: String(r?.id ?? r?.Id ?? `r-${i}`),
          name: String(r?.name ?? r?.Name ?? ''),
          bellCode: String(r?.bellCode ?? r?.BellCode ?? '').trim().toLowerCase(),
          enabled: r?.enabled !== false && r?.Enabled !== false,
        }));
        setRemotes(list);
      } catch {
        // ignore
      }
    };
    loadRemotes();
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(''), 1800);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  // 저장된 계정이 있으면 자동 로그인(알림창에서도)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(AUTO_LOGIN_KEY);
        if (!raw) return;
        const o = JSON.parse(raw) as { userid?: string; userpw?: string };
        const uid = (o?.userid ?? '').trim();
        const pw = o?.userpw ?? '';
        if (!uid || !pw) return;
        const ok = await lnms.lnmsLogin(uid, pw);
        if (cancelled) return;
        if (!ok.success) return;
        setIsLoggedIn(true);
        setLoginId(uid);
        try {
          const list = await lnms.lnmsGetStores(uid);
          if (cancelled) return;
          const arr = Array.isArray(list) ? list : [];
          setStoresForUser(arr);
          setSelectedStoreId(arr[0]?.storeid ?? null);
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLoginSubmit = async () => {
    const uid = loginId.trim();
    const pw = loginPw;
    if (!uid || !pw) {
      await showCustomAlert('아이디와 비밀번호를 입력하세요.');
      return;
    }
    try {
      const ok = await lnms.lnmsLogin(uid, pw);
      if (!ok.success) {
        await showCustomAlert('아이디 또는 비밀번호가 올바르지 않습니다.');
        return;
      }
      localStorage.setItem(AUTO_LOGIN_KEY, JSON.stringify({ userid: uid, userpw: pw }));
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setLoginPw('');
      const stores = await lnms.lnmsGetStores(uid);
      const arr = Array.isArray(stores) ? stores : [];
      setStoresForUser(arr);
      setSelectedStoreId(arr[0]?.storeid ?? null);
    } catch {
      await showCustomAlert('로그인 요청에 실패했습니다.');
    }
  };

  const openDownloadModal = async () => {
    if (!isLoggedIn) {
      await showCustomAlert('먼저 로그인하세요.');
      return;
    }
    if (!selectedStoreId) {
      await showCustomAlert('매장을 선택하세요.');
      return;
    }
    try {
      const store = await lnms.lnmsGetStore(selectedStoreId);
      const setids = Array.isArray(store?.setids) ? store.setids : [];
      setDownloadSetList(setids);
      setSelectedDownloadSetId(setids[0] ?? '');
      setShowDownloadModal(true);
    } catch (e) {
      await showCustomAlert(e instanceof Error ? e.message : '세트 목록 조회 실패');
    }
  };

  const applyDownloadedSet = async () => {
    const setid = selectedDownloadSetId.trim();
    if (!setid) {
      await showCustomAlert('세트를 선택하세요.');
      return;
    }
    try {
      const cfg = await lnms.lnmsGetSetConfig(setid, loginId.trim() || undefined);
      const apiUrl = await getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/settingsapply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setid,
          phrases: cfg.phrases,
          serial: cfg.serial,
          ...remoteControlForSettingsApply(cfg.remoteControl),
        }),
      });
      if (!res.ok) throw new Error('설정 적용 실패');
      await showCustomAlert(`세트 "${setid}"를 내려받아 적용했습니다.`);
      setShowDownloadModal(false);
    } catch (e) {
      await showCustomAlert(e instanceof Error ? e.message : '다운로드/적용 실패');
    }
  };

  // 자동 꺼짐 타이머: "현재 1개"가 있을 때만 동작
  useEffect(() => {
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    if (!activeNotifications || activeNotifications.length === 0) return;

    const current = activeNotifications[0];
    if (!current?.autoCloseEnabled) return;
    const ms = Math.max(1, Number(current?.autoCloseSeconds ?? 10)) * 1000;
    autoCloseTimerRef.current = window.setTimeout(() => {
      handleConfirm(current.uid);
    }, ms);

    return () => {
      if (autoCloseTimerRef.current) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [activeNotifications]);

  const playTTS = async (text: string) => {
    try {
      // TTS 활성화 상태 확인
      const apiUrl = await getApiBaseUrl();
      const ttsResponse = await fetch(`${apiUrl}/api/tts/enabled`);
      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        if (!ttsData.enabled) {
          return; // TTS가 비활성화되어 있으면 재생하지 않음
        }
      }

      // TTS 재생
      await fetch(`${apiUrl}/api/tts/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
  };

  const handleConfirm = async (uid?: string) => {
    const backendUrl = await getBackendUrl();
    const apiUrl = await getApiBaseUrl();

    try {
      await fetch(`${backendUrl}/api/notifications/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uid ? { uid, hideWindow: false } : { hideWindow: false }),
      });
    } catch (error) {
      console.error('알림 확인(서버) 실패:', error);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/notifications/active`);
      if (response.ok) {
        const data = await response.json();
        const list = data?.notifications ?? [];
        if (!list || list.length === 0) {
          await fetch(`${apiUrl}/api/window/hide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (error) {
      console.error('창 닫기 판단 실패:', error);
    }
  };

  const handleConfirmAll = async () => {
    const backendUrl = await getBackendUrl();
    const apiUrl = await getApiBaseUrl();
    try {
      await fetch(`${backendUrl}/api/notifications/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true, hideWindow: true }),
      });
      await fetch(`${apiUrl}/api/window/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('일괄 확인 실패:', error);
    }
  };

  const handleSettingsClick = async () => {
    const pw = await showCustomPrompt({
      title: '설정',
      message: '비밀번호를 입력하세요',
      placeholder: '비밀번호',
      password: true,
    });
    if (pw === null) return;
    if (String(pw).trim() !== systemAccessPassword) {
      await showCustomAlert('비밀번호가 올바르지 않습니다.');
      return;
    }

    onNavigateToSettings();
  };

  const showToast = (message: string, type: 'ok' | 'error' = 'ok') => {
    setToastType(type);
    setToastMsg(message);
  };

  const handleRemotePadClick = async (keyIndex: number) => {
    if (remoteSendingKey != null) return;
    const enabled = remotes.filter((r) => r.enabled);
    const target = enabled[keyIndex - 1];
    if (!target?.bellCode) {
      showToast(`${keyIndex}번 키에 연결된 벨코드가 없습니다.`, 'error');
      return;
    }
    try {
      setRemoteSendingKey(keyIndex);
      const apiUrl = await getApiBaseUrl();
      const remoteKey = String(keyIndex).padStart(4, '0');
      const res = await fetch(`${apiUrl}/api/remotecontrol/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bellCode: target.bellCode,
          keyIndex,
          remoteKey,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || '리모콘 TX 실패');
      showToast(`${keyIndex}번 전송 완료`, 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '리모콘 전송 실패', 'error');
    } finally {
      setRemoteSendingKey(null);
    }
  };

  return (
    <div className="notification-view">
      {/* 중앙 콘텐츠 영역 */}
      <div className="notification-content-area">
        {/* 상단 타이틀 + 큐 건수 */}
        <div className="notification-header">
          <h1 className="notification-title">{notificationTitle}</h1>
          {queueLength > 0 && (
            <span className="notification-queue-badge">{queueLength}건 대기</span>
          )}
        </div>

        {/* 콘텐츠 본문 */}
        <div className="notification-content-body">
          {/* 좌측 장애인 이미지 */}
          <div className="notification-image-container">
            {activeNotifications.length > 0 ? (
              <img
                // 문구에 등록된 이미지가 최우선
                src={(activeNotifications[0]?.imageUrl || '/acc.png') as string}
                alt="알림 이미지"
                className="notification-image"
              />
            ) : null}
          </div>

          {/* 우측 문구 텍스트 */}
          <div className="notification-text-container">
            <div className="notification-message-text">
              {(() => {
                if (activeNotifications.length > 0) {
                const item = activeNotifications[0];
                return (
                  <div style={{ marginBottom: 0 }}>
                    <div
                      style={{
                        color: item.color || '#FFFFFF',
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {item.message?.trim() ? item.message : ''}
                    </div>
                  </div>
                );
                } else {
                  // 기본(알림 없음) 화면: 이미지/글씨 없이 빈 상태
                  return null;
                }
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 버튼 영역 */}
      <div className="notification-bottom-controls">
        {systemNotifyCallTelText?.trim() ? (
          <div className="notification-calltel-text">{systemNotifyCallTelText}</div>
        ) : null}
        <div className="notification-center-actions">
          <button
            className="notification-confirm-button"
            onClick={() => handleConfirm(activeNotifications[0]?.uid)}
            disabled={!activeNotifications[0]?.uid}
          >
            확인
          </button>
          {(queueLength > 0 || activeNotifications.length > 0) && (
            <button
              className="notification-confirm-all-button"
              onClick={handleConfirmAll}
            >
              일괄 확인
            </button>
          )}
        </div>

        <div className="notification-right-actions">
          <button
            className={`notification-remote-button ${showRemotePad ? 'active' : ''}`}
            type="button"
            onClick={() => setShowRemotePad((v) => !v)}
            title="리모콘 패널"
          >
            리모콘
          </button>
          <button
            className="notification-login-button"
            type="button"
            onClick={() => setShowLoginModal(true)}
            title={isLoggedIn ? `로그인됨: ${loginId}` : '로그인'}
          >
            로그인
          </button>
          <button
            className="notification-settings-icon"
            onClick={handleSettingsClick}
            title="기능 설정"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.01131 9.77251C4.28062 9.5799 4.48571 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 로그인 후에만 내려받기 버튼 노출 */}
      {isLoggedIn && (
        <div className="notification-download-controls">
          <button type="button" className="notification-download-button" onClick={openDownloadModal}>
            서버에서 내려받기
          </button>
        </div>
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
                <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="admin" />
              </div>
              <div className="form-group">
                <label>비밀번호</label>
                <input type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} placeholder="admin" />
              </div>
              {storesForUser.length > 0 && (
                <div className="form-group">
                  <label>매장 선택</label>
                  <select value={selectedStoreId ?? ''} onChange={e => setSelectedStoreId(e.target.value || null)}>
                    <option value="">선택</option>
                    {storesForUser.map(s => <option key={s.storeid} value={s.storeid}>{s.storeid}</option>)}
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
        <div className="modal-overlay" onClick={() => setShowDownloadModal(false)}>
          <div className="modal-content settings-transfer-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>서버에서 내려받기</h2>
              <button className="modal-close" onClick={() => setShowDownloadModal(false)}>×</button>
            </div>
            <div className="modal-form">
              <p className="transfer-hint">매장에 연결된 세트 중 하나를 선택해 이 PC(로컬 에이전트)에 적용합니다.</p>
              <div className="form-group">
                <label>세트 선택</label>
                <select value={selectedDownloadSetId} onChange={e => setSelectedDownloadSetId(e.target.value)}>
                  <option value="">선택</option>
                  {downloadSetList.map(sid => <option key={sid} value={sid}>{sid}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setShowDownloadModal(false)}>취소</button>
                <button type="button" className="save-button" onClick={applyDownloadedSet}>내려받기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRemotePad && (
        <div className="notification-remote-pad">
          <div className="notification-remote-pad-grid">
            {Array.from({ length: 8 }, (_, i) => {
              const keyNo = i + 1;
              const mapped = remotes.filter((r) => r.enabled)[i];
              return (
                <button
                  key={keyNo}
                  type="button"
                  className="notification-remote-key"
                  disabled={remoteSendingKey != null}
                  onClick={() => void handleRemotePadClick(keyNo)}
                  title={mapped?.bellCode || '미연결'}
                >
                  {keyNo}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {toastMsg && (
        <div className={`notification-toast ${toastType === 'error' ? 'error' : 'ok'}`}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default NotificationView;

