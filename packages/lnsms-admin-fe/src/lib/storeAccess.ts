'use client';

import { auth } from './auth';
import { hostAuth } from './hostAuth';
import { isLocalHostSite, isPlatformSite, isStoreSite } from './siteMode';

const VIRTUAL_SCOPE_KEY = 'lnsms_platform_store_scope';

export function getVirtualStoreScope(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(VIRTUAL_SCOPE_KEY);
}

export function clearVirtualStoreScope() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(VIRTUAL_SCOPE_KEY);
}

export function setVirtualStoreScope(userid: string, storeId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(VIRTUAL_SCOPE_KEY, `${userid}.${storeId}`);
}

/** Platform admin이 매장 콘솔을 host 로그인 없이 admin 토큰으로 사용 중 */
export function isPlatformStoreProxy(userid: string, storeId: string): boolean {
  if (!isPlatformSite() || !auth.isAuthenticated()) return false;
  const scope = getVirtualStoreScope();
  return !scope || scope === `${userid}.${storeId}`;
}

export function storeAuthHeaders(userid: string, storeId: string): Record<string, string> {
  if (isPlatformStoreProxy(userid, storeId)) {
    const token = auth.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const host = hostAuth.getAccessToken();
  if (host) {
    const key = hostAuth.getStoreKey();
    if (!key || key === `${userid}.${storeId}`) {
      return { Authorization: `Bearer ${host}` };
    }
  }

  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function storeWsToken(userid: string, storeId: string): string | null {
  if (isPlatformStoreProxy(userid, storeId)) return auth.getToken();
  return hostAuth.getAccessToken() || auth.getToken();
}

export function canAccessStore(userid: string, storeId: string): boolean {
  if (isLocalHostSite()) return hostAuth.isAuthenticated();
  if (isStoreSite()) {
    if (!hostAuth.isAuthenticated()) return false;
    const key = hostAuth.getStoreKey();
    return !key || key === `${userid}.${storeId}`;
  }
  if (isPlatformSite()) return auth.isAuthenticated();
  return auth.isAuthenticated();
}

export async function ensureStoreAccess(userid: string, storeId: string): Promise<void> {
  if (isLocalHostSite()) {
    clearVirtualStoreScope();
    await hostAuth.autoLoginLocal();
    return;
  }

  if (isStoreSite()) {
    clearVirtualStoreScope();
    const ok = hostAuth.isAuthenticated() && (await hostAuth.verify(''));
    if (!ok) throw new Error('로그인이 필요합니다');
    const key = hostAuth.getStoreKey();
    if (key && key !== `${userid}.${storeId}`) {
      throw new Error('다른 매장 계정으로 로그인되어 있습니다');
    }
    return;
  }

  if (isPlatformSite()) {
    if (!auth.isAuthenticated()) throw new Error('Platform 로그인이 필요합니다');
    setVirtualStoreScope(userid, storeId);
    return;
  }

  if (!auth.isAuthenticated()) throw new Error('로그인이 필요합니다');
}
