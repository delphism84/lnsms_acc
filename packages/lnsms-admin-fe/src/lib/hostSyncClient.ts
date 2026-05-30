import { hostAuth } from './hostAuth';
import { remoteHostAuth } from './remoteHostAuth';
import { LOCAL_STORE_ID, LOCAL_USERID, REMOTE_API_URL } from './storeScopePaths';

export type SyncBundle = {
  version: number;
  userid: string;
  storeId: string;
  storeRef: string;
  exportedAt: string;
  store?: unknown;
  collections: Record<string, unknown[]>;
  files: unknown[];
};

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || (err as { error?: string }).error || res.statusText
    );
  }
  return res.json() as Promise<T>;
}

async function hostExport(apiBase: string, userid: string, storeId: string, token: string): Promise<SyncBundle> {
  const res = await fetch(`${apiBase}/api/host/${encodeURIComponent(userid)}/${encodeURIComponent(storeId)}/sync/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: '{}',
  });
  return readJson<SyncBundle>(res);
}

async function hostImport(
  apiBase: string,
  userid: string,
  storeId: string,
  token: string,
  bundle: SyncBundle
): Promise<{ success: boolean; exportedAt?: string }> {
  const res = await fetch(`${apiBase}/api/host/${encodeURIComponent(userid)}/${encodeURIComponent(storeId)}/sync/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bundle, mode: 'replace' }),
  });
  const data = await readJson<{ success: boolean }>(res);
  return { ...data, exportedAt: bundle.exportedAt };
}

function localApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || '').trim() || '';
}

/** 로컬 necall.guest → 원격 JWT 매장 */
export async function uploadLocalToRemote(): Promise<{ exportedAt: string; remote: string }> {
  const remote = remoteHostAuth.getSession();
  const localToken = hostAuth.getAccessToken();
  const remoteToken = remoteHostAuth.getAccessToken();
  if (!localToken) throw new Error('로컬 Host 토큰이 없습니다.');
  if (!remote || !remoteToken) throw new Error('원격 로그인이 필요합니다.');

  const bundle = await hostExport(localApiBase(), LOCAL_USERID, LOCAL_STORE_ID, localToken);
  await hostImport(REMOTE_API_URL, remote.userid, remote.storeId, remoteToken, bundle);
  return { exportedAt: bundle.exportedAt, remote: `${remote.userid}.${remote.storeId}` };
}

/** 원격 JWT 매장 → 로컬 necall.guest */
export async function downloadRemoteToLocal(): Promise<{ exportedAt: string; remote: string }> {
  const remote = remoteHostAuth.getSession();
  const localToken = hostAuth.getAccessToken();
  const remoteToken = remoteHostAuth.getAccessToken();
  if (!localToken) throw new Error('로컬 Host 토큰이 없습니다.');
  if (!remote || !remoteToken) throw new Error('원격 로그인이 필요합니다.');

  const bundle = await hostExport(REMOTE_API_URL, remote.userid, remote.storeId, remoteToken);
  await hostImport(localApiBase(), LOCAL_USERID, LOCAL_STORE_ID, localToken, bundle);
  return { exportedAt: bundle.exportedAt, remote: `${remote.userid}.${remote.storeId}` };
}

export const hostSyncClient = {
  uploadToServer: uploadLocalToRemote,
  downloadFromServer: downloadRemoteToLocal,
};
