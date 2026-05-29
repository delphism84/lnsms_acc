import type { SyncBundle } from '@/src/lib/platformApi';

export function normalizeApiBase(url: string): string {
  const u = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(u)) {
    throw new Error('서버 URL은 http:// 또는 https:// 로 시작해야 합니다.');
  }
  return u;
}

export function resolveLocalApiBase(): string {
  const base =
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:40000';
  return normalizeApiBase(base);
}

export function resolveRemoteApiBase(override?: string): string {
  const raw =
    (override || '').trim() ||
    (process.env.LNSMS_SYNC_SERVER_URL || '').trim() ||
    (process.env.NEXT_PUBLIC_LNSMS_SYNC_SERVER_URL || '').trim();
  if (!raw) {
    throw new Error(
      '원격 서버 URL이 없습니다. 매장 화면에 입력하거나 LNSMS_SYNC_SERVER_URL 환경 변수를 설정하세요.'
    );
  }
  return normalizeApiBase(raw);
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { message?: string }).message ||
      (err as { error?: string }).error ||
      res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function exportBundle(
  apiBase: string,
  agentId: string,
  storeId: string
): Promise<SyncBundle> {
  const res = await fetch(`${apiBase}/api/platform/sync/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, storeId }),
  });
  return readJson<SyncBundle>(res);
}

export async function importBundle(
  apiBase: string,
  agentId: string,
  storeId: string,
  bundle: SyncBundle,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ success: boolean }> {
  const res = await fetch(`${apiBase}/api/platform/sync/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, storeId, bundle, mode }),
  });
  return readJson(res);
}

/** 로컬 Mongo → 원격 서버 Mongo */
export async function uploadStoreToServer(
  agentId: string,
  storeId: string,
  remoteBaseOverride?: string
) {
  const local = resolveLocalApiBase();
  const remote = resolveRemoteApiBase(remoteBaseOverride);
  const bundle = await exportBundle(local, agentId, storeId);
  await importBundle(remote, agentId, storeId, bundle, 'replace');
  return { local, remote, exportedAt: bundle.exportedAt };
}

/** 원격 서버 Mongo → 로컬 Mongo */
export async function downloadStoreFromServer(
  agentId: string,
  storeId: string,
  remoteBaseOverride?: string
) {
  const local = resolveLocalApiBase();
  const remote = resolveRemoteApiBase(remoteBaseOverride);
  const bundle = await exportBundle(remote, agentId, storeId);
  await importBundle(local, agentId, storeId, bundle, 'replace');
  return { local, remote, exportedAt: bundle.exportedAt };
}
