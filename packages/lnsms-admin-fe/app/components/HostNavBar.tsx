'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { hostAuth } from '@/src/lib/hostAuth';
import { clearVirtualStoreScope, ensureStoreAccess } from '@/src/lib/storeAccess';
import { remoteHostAuth, isOnlineMode } from '@/src/lib/remoteHostAuth';
import { isLocalHostSite, isPlatformSite, isStoreSite } from '@/src/lib/siteMode';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';
import RemoteLoginModal from './RemoteLoginModal';
import '@/app/styles/store-backup-settings.css';

export default function HostNavBar() {
  const router = useRouter();
  const params = useParams();
  const userid = String(params.agentId || LOCAL_USERID);
  const storeId = String(params.storeId || LOCAL_STORE_ID);
  const storeSite = isStoreSite();
  const localHostSite = isLocalHostSite();
  const platformSite = isPlatformSite();

  const [ready, setReady] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [online, setOnline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [remoteSession, setRemoteSession] = useState<ReturnType<typeof remoteHostAuth.getSession>>(null);

  const refreshOnline = useCallback(async () => {
    if (storeSite) return;
    setOnline(await isOnlineMode());
    setRemoteSession(remoteHostAuth.getSession());
  }, [storeSite]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureStoreAccess(userid, storeId);
        if (!cancelled) {
          setReady(true);
          setLoginError('');
        }
      } catch (err) {
        if (!cancelled) {
          setLoginError(err instanceof Error ? err.message : '로그인 실패');
          if (storeSite || platformSite) router.replace('/login');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformSite, router, storeSite, userid, storeId]);

  useEffect(() => {
    if (storeSite || platformSite) return;

    let cancelled = false;
    const refresh = async () => {
      if (cancelled) return;
      setOnline(await isOnlineMode());
      setRemoteSession(remoteHostAuth.getSession());
    };

    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [platformSite, storeSite]);

  const handleHostLogout = () => {
    if (platformSite) {
      clearVirtualStoreScope();
      router.push('/platform');
      return;
    }
    hostAuth.logout();
    router.push('/login');
  };

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
          {!ready && !loginError ? (
            <span className="appbar-active-setid">
              {storeSite || platformSite ? '접속 확인…' : '로컬 로그인…'}
            </span>
          ) : null}
          {loginError ? <span className="appbar-active-setid" style={{ color: '#ffb4ab' }}>{loginError}</span> : null}
        </div>

        <div className="appbar-actions">
          {storeSite ? (
            ready ? (
              <button type="button" className="appbar-btn" onClick={handleHostLogout}>
                로그아웃
              </button>
            ) : null
          ) : platformSite ? (
            ready ? (
              <button type="button" className="appbar-btn" onClick={handleHostLogout}>
                매장 목록
              </button>
            ) : null
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {!storeSite && !platformSite ? (
        <RemoteLoginModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={refreshOnline} />
      ) : null}
    </>
  );
}
