/** Subpath URL helpers — Platform vs Store site */

export function storeSiteBase(agentId: string, storeId: string) {
  return `/s/${encodeURIComponent(agentId)}/${encodeURIComponent(storeId)}`;
}

export function storeSiteSetting(agentId: string, storeId: string, storeRef?: string) {
  const base = `${storeSiteBase(agentId, storeId)}/setting`;
  if (!storeRef) return base;
  return `${base}?storeRef=${encodeURIComponent(storeRef)}`;
}

export function storeApiBase(agentId: string, storeId: string) {
  return `/api/s/${encodeURIComponent(agentId)}/${encodeURIComponent(storeId)}`;
}

export function platformPath(sub = '') {
  const p = sub.startsWith('/') ? sub : sub ? `/${sub}` : '';
  return `/platform${p}`;
}

/** 로컬 단일 매장 모드: NEXT_PUBLIC_STORE_AGENT_ID + NEXT_PUBLIC_STORE_STORE_ID */
export function localStoreSettingPath(): string | null {
  const agentId = (process.env.NEXT_PUBLIC_STORE_AGENT_ID || '').trim();
  const storeId = (process.env.NEXT_PUBLIC_STORE_STORE_ID || '').trim();
  if (!agentId || !storeId) return null;
  return storeSiteSetting(agentId, storeId);
}
