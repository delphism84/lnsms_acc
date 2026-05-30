'use client';

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowDown, faCloudArrowUp, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { hostSyncClient } from '@/src/lib/hostSyncClient';
import { isOnlineMode, remoteHostAuth } from '@/src/lib/remoteHostAuth';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';

type Props = {
  onSynced?: () => void;
};

export default function StoreServerSyncPanel({ onSynced }: Props) {
  const [online, setOnline] = useState(false);
  const [remoteKey, setRemoteKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'download' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = async () => {
      setOnline(await isOnlineMode());
      const s = remoteHostAuth.getSession();
      setRemoteKey(s ? `${s.userid}.${s.storeId}` : null);
    };
    void refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const run = async (kind: 'upload' | 'download') => {
    if (!online) {
      setError('온라인 모드(원격 로그인 + 서버 연결)에서만 sync 할 수 있습니다.');
      return;
    }
    const verb = kind === 'upload' ? '로컬 → 원격' : '원격 → 로컬';
    if (
      !window.confirm(
        `${verb} 동기화를 실행할까요?\n\n로컬: ${LOCAL_USERID}.${LOCAL_STORE_ID}\n원격: ${remoteKey || '?'}\n\n기존 데이터는 **무조건 덮어씁니다 (replace)**.`
      )
    ) {
      return;
    }
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      const result =
        kind === 'upload'
          ? await hostSyncClient.uploadToServer()
          : await hostSyncClient.downloadFromServer();
      setMessage(`${verb} 완료 · ${new Date(result.exportedAt).toLocaleString()}`);
      onSynced?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '동기화 실패');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-2">서버 DB 동기화</h2>
      <p className="text-sm text-gray-400 mb-4">
        로컬 <span className="text-gray-200">{LOCAL_USERID}.{LOCAL_STORE_ID}</span>
        {remoteKey ? (
          <> ↔ 원격 <span className="text-gray-200">{remoteKey}</span></>
        ) : (
          <> · AppBar <strong className="text-gray-300">로그인</strong> 후 사용</>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busy || !online}
          onClick={() => void run('upload')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-40"
          title={!online ? '원격 로그인 + 온라인 필요' : undefined}
        >
          {busy === 'upload' ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudArrowUp} />}
          서버로 업로드
        </button>
        <button
          type="button"
          disabled={!!busy || !online}
          onClick={() => void run('download')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm disabled:opacity-40"
          title={!online ? '원격 로그인 + 온라인 필요' : undefined}
        >
          {busy === 'download' ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudArrowDown} />}
          서버에서 다운로드
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
