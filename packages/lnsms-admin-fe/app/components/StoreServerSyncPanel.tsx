'use client';

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowDown, faCloudArrowUp, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { hostSyncClient } from '@/src/lib/hostSyncClient';
import { isOnlineMode, remoteHostAuth } from '@/src/lib/remoteHostAuth';
import { canAccessStore } from '@/src/lib/storeAccess';
import {
  downloadBundleFile,
  exportStoreBundle,
  importStoreBundle,
  readBundleFile,
} from '@/src/lib/platformStoreSync';
import { isLocalHostSite, isPlatformSite } from '@/src/lib/siteMode';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';

type Props = {
  userid: string;
  storeId: string;
  onSynced?: () => void;
};

export default function StoreServerSyncPanel({ userid, storeId, onSynced }: Props) {
  const localHost = isLocalHostSite();
  const platform = isPlatformSite();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [online, setOnline] = useState(false);
  const [remoteKey, setRemoteKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'download' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platformReady = platform && canAccessStore(userid, storeId);
  const localReady = localHost && online;
  const syncEnabled = platform ? platformReady : localReady;

  useEffect(() => {
    if (!localHost) return;
    const refresh = async () => {
      setOnline(await isOnlineMode());
      const s = remoteHostAuth.getSession();
      setRemoteKey(s ? `${s.userid}.${s.storeId}` : null);
    };
    void refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [localHost]);

  const runLocalSync = async (kind: 'upload' | 'download') => {
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

  const runPlatformDownload = async () => {
    setBusy('download');
    setError(null);
    setMessage(null);
    try {
      const bundle = await exportStoreBundle(userid, storeId);
      downloadBundleFile(bundle);
      setMessage(`서버 데이터 내보내기 완료 · ${new Date(bundle.exportedAt).toLocaleString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내기 실패');
    } finally {
      setBusy(null);
    }
  };

  const runPlatformUpload = async (file: File) => {
    if (
      !window.confirm(
        `서버 매장 ${userid}.${storeId} 데이터를 백업 파일로 덮어쓸까요?\n\n기존 데이터는 **무조건 replace** 됩니다.`
      )
    ) {
      return;
    }
    setBusy('upload');
    setError(null);
    setMessage(null);
    try {
      const bundle = await readBundleFile(file);
      await importStoreBundle(userid, storeId, bundle);
      setMessage(`서버 데이터 가져오기 완료 · ${bundle.exportedAt || new Date().toISOString()}`);
      onSynced?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '가져오기 실패');
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = () => {
    if (platform) void runPlatformDownload();
    else void runLocalSync('download');
  };

  const handleUploadClick = () => {
    if (platform) fileInputRef.current?.click();
    else void runLocalSync('upload');
  };

  return (
    <div className="store-sync-panel">
      <h2>{platform ? '서버 DB 백업 / 복원' : '서버 DB 동기화'}</h2>
      {platform ? (
        <p>
          매장 <strong>{userid}.{storeId}</strong> 데이터를 JSON으로 내보내거나 서버에 가져옵니다.
        </p>
      ) : (
        <p>
          로컬 <strong>{LOCAL_USERID}.{LOCAL_STORE_ID}</strong>
          {remoteKey ? (
            <> ↔ 원격 <strong>{remoteKey}</strong></>
          ) : (
            <> · AppBar <strong>로그인</strong> 후 사용</>
          )}
        </p>
      )}

      {platform ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void runPlatformUpload(file);
          }}
        />
      ) : null}

      <div className="store-action-row">
        <button
          type="button"
          disabled={!!busy || !syncEnabled}
          onClick={handleDownload}
          className="store-action-sm store-action-neutral settings-neutral-btn"
          title={!syncEnabled ? (platform ? 'Platform 로그인 필요' : '원격 로그인 + 온라인 필요') : undefined}
        >
          {busy === 'download' ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudArrowDown} />}
          서버에서 다운로드
        </button>
        <button
          type="button"
          disabled={!!busy || !syncEnabled}
          onClick={handleUploadClick}
          className="store-action-sm store-action-primary settings-primary-btn"
          title={!syncEnabled ? (platform ? 'Platform 로그인 필요' : '원격 로그인 + 온라인 필요') : undefined}
        >
          {busy === 'upload' ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudArrowUp} />}
          서버로 업로드
        </button>
      </div>
      {message && <p className="store-sync-msg-ok">{message}</p>}
      {error && <p className="store-sync-msg-err">{error}</p>}
    </div>
  );
}
