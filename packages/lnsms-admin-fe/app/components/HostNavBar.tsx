'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { hostAuth } from '@/src/lib/hostAuth';
import { remoteHostAuth, isOnlineMode } from '@/src/lib/remoteHostAuth';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';
import RemoteLoginModal from './RemoteLoginModal';

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
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-gray-700 bg-gray-900/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-semibold text-white truncate">LNSMS Host</span>
            <span className="text-sm text-gray-400 truncate">
              {userid}.{storeId}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!ready && !loginError ? (
              <span className="text-xs text-gray-500">로컬 로그인…</span>
            ) : null}
            {loginError ? <span className="text-xs text-red-400 max-w-[12rem] truncate">{loginError}</span> : null}

            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                online ? 'bg-emerald-900/80 text-emerald-300' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {online ? '온라인' : '오프라인'}
            </span>

            {remoteSession ? (
              <>
                <span className="hidden sm:inline text-xs text-gray-400">
                  원격 {remoteSession.userid}.{remoteSession.storeId}
                </span>
                <button
                  type="button"
                  onClick={handleRemoteLogout}
                  className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-300 hover:text-white"
                >
                  원격 로그아웃
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-300 hover:text-white"
                >
                  재로그인
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </div>

      <RemoteLoginModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={refreshOnline}
      />
    </>
  );
}
