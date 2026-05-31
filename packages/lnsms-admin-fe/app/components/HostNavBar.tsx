'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { hostAuth } from '@/src/lib/hostAuth';
import { remoteHostAuth, isOnlineMode } from '@/src/lib/remoteHostAuth';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';
import RemoteLoginModal from './RemoteLoginModal';
import '@/app/styles/store-backup-settings.css';

export default function HostNavBar() {
  const params = useParams();
  const userid = String(params.agentId || LOCAL_USERID);
  const storeId = String(params.storeId || LOCAL_STORE_ID);

  const [ready, setReady] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [online, setOnline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [remoteSession, setRemoteSession] = useState<ReturnType<typeof remoteHostAuth.getSession>>(null);

  const refreshOnline = useCallback(async () => {
    setOnline(await isOnlineMode());
    setRemoteSession(remoteHostAuth.getSession());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await hostAuth.autoLoginLocal();
        if (!cancelled) {
          setReady(true);
          setLoginError('');
        }
      } catch (err) {
        if (!cancelled) {
          setLoginError(err instanceof Error ? err.message : '로컬 로그인 실패');
        }
      }
      await refreshOnline();
    })();

    const timer = setInterval(refreshOnline, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshOnline]);

  const handleRemoteLogout = () => {
    remoteHostAuth.logout();
    refreshOnline();
  };

  return (
    <>
      <div className="settings-appbar fixed top-0 left-0 right-0 z-50">
        <div className="appbar-left">
          <span className="appbar-title">LNSMS 매장</span>
          <span className="appbar-active-setid">{userid}.{storeId}</span>
          {!ready && !loginError ? <span className="appbar-active-setid">로컬 로그인…</span> : null}
          {loginError ? <span className="appbar-active-setid" style={{ color: '#ffb4ab' }}>{loginError}</span> : null}
        </div>

        <div className="appbar-actions">
          <span
            className="appbar-btn"
            style={{
              cursor: 'default',
              background: online ? 'rgba(52, 199, 89, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              borderColor: online ? 'rgba(52, 199, 89, 0.5)' : 'rgba(255, 255, 255, 0.2)',
            }}
          >
            {online ? '온라인' : '오프라인'}
          </span>

          {remoteSession ? (
            <>
              <span className="appbar-active-setid hidden sm:inline">
                원격 {remoteSession.userid}.{remoteSession.storeId}
              </span>
              <button type="button" className="appbar-btn" onClick={handleRemoteLogout}>
                원격 로그아웃
              </button>
              <button type="button" className="appbar-btn" onClick={() => setModalOpen(true)}>
                재로그인
              </button>
            </>
          ) : (
            <button type="button" className="appbar-btn" onClick={() => setModalOpen(true)}>
              로그인
            </button>
          )}
        </div>
      </div>

      <RemoteLoginModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={refreshOnline} />
    </>
  );
}
