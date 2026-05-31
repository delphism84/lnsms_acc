import { getApiUrl } from './apiUrl';
import { storeAuthHeaders } from './storeAccess';
import type { SyncBundle } from './hostSyncClient';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || (err as { error?: string }).error || res.statusText
    );
  }
  return res.json() as Promise<T>;
}

export async function exportStoreBundle(userid: string, storeId: string): Promise<SyncBundle> {
  const res = await fetch(
    `${getApiUrl()}/api/host/${encodeURIComponent(userid)}/${encodeURIComponent(storeId)}/sync/export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...storeAuthHeaders(userid, storeId) },
      body: '{}',
    }
  );
  return readJson<SyncBundle>(res);
}

export async function importStoreBundle(
  userid: string,
  storeId: string,
  bundle: SyncBundle
): Promise<{ success: boolean }> {
  const res = await fetch(
    `${getApiUrl()}/api/host/${encodeURIComponent(userid)}/${encodeURIComponent(storeId)}/sync/import`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...storeAuthHeaders(userid, storeId) },
      body: JSON.stringify({ bundle, mode: 'replace' }),
    }
  );
  return readJson<{ success: boolean }>(res);
}

export function downloadBundleFile(bundle: SyncBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bundle.userid}.${bundle.storeId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readBundleFile(file: File): Promise<SyncBundle> {
  const text = await file.text();
  const bundle = JSON.parse(text) as SyncBundle;
  if (!bundle?.collections) throw new Error('유효하지 않은 백업 파일입니다.');
  return bundle;
}
