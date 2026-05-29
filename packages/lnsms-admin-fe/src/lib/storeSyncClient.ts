const STORAGE_KEY = 'lnsms_sync_server_url';

export function getStoredSyncServerUrl(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(STORAGE_KEY) ||
    (process.env.NEXT_PUBLIC_LNSMS_SYNC_SERVER_URL || '').trim()
  );
}

export function setStoredSyncServerUrl(url: string) {
  if (typeof window === 'undefined') return;
  const v = url.trim();
  if (v) localStorage.setItem(STORAGE_KEY, v);
  else localStorage.removeItem(STORAGE_KEY);
}

async function syncPost(path: 'upload' | 'download', agentId: string, storeId: string, serverUrl: string) {
  const res = await fetch(`/api/sync/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      storeId,
      ...(serverUrl ? { serverUrl } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as { success: boolean; local: string; remote: string; exportedAt?: string };
}

export const storeSyncClient = {
  uploadToServer: (agentId: string, storeId: string, serverUrl: string) =>
    syncPost('upload', agentId, storeId, serverUrl),
  downloadFromServer: (agentId: string, storeId: string, serverUrl: string) =>
    syncPost('download', agentId, storeId, serverUrl),
};
