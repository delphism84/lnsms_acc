'use client';

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowDown, faCloudArrowUp, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getStoredSyncServerUrl, setStoredSyncServerUrl, storeSyncClient } from '@/src/lib/storeSyncClient';

type Props = {
  agentId: string;
  storeId: string;
  onSynced?: () => void;
};

export default function StoreServerSyncPanel({ agentId, storeId, onSynced }: Props) {
  const [serverUrl, setServerUrl] = useState('');
  const [busy, setBusy] = useState<'upload' | 'download' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setServerUrl(getStoredSyncServerUrl());
  }, []);

  const persistUrl = (url: string) => {
    setServerUrl(url);
    setStoredSyncServerUrl(url);
  };

  const run = async (kind: 'upload' | 'download') => {
    const url = serverUrl.trim();
    if (!url) {
      setError('운영 서버 URL을 입력하세요. (예: https://admin.example.com)');
      return;
    }
    const verb = kind === 'upload' ? '로컬 → 서버' : '서버 → 로컬';
    if (
      !window.confirm(
        `${verb} 동기화를 실행할까요?\n대상 매장: ${agentId} / ${storeId}\n서버: ${url}\n\n기존 categories/menus/devices/set_configs는 replace 됩니다.`
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
          ? await storeSyncClient.uploadToServer(agentId, storeId, url)
          : await storeSyncClient.downloadFromServer(agentId, storeId, url);
      setMessage(
        `${verb} 완료 (${result.exportedAt ? new Date(result.exportedAt).toLocaleString() : ''})`
      );
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
        업로드: 이 PC(로컬 BE) DB → 운영 서버. 다운로드: 운영 서버 → 로컬. 매장 화면 데이터는 새로고침 후
        반영됩니다. (업로드 미디어 파일 바이너리는 bundle에 포함되지 않습니다.)
      </p>
      <label className="block text-sm text-gray-300 mb-1">운영 서버 API 베이스</label>
      <input
        type="url"
        value={serverUrl}
        onChange={(e) => persistUrl(e.target.value)}
        placeholder="https://your-admin-host (BE :40000 또는 nginx 동일 호스트)"
        className="w-full max-w-xl bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white mb-4"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('upload')}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          {busy === 'upload' ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudArrowUp} />}
          서버로 업로드
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('download')}
          className="bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          {busy === 'download' ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <FontAwesomeIcon icon={faCloudArrowDown} />
          )}
          서버에서 다운로드
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
