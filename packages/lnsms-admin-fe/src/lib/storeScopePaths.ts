/** Store site URL + API helpers (greenfield: userid + storeId) */

export const LOCAL_USERID = (process.env.NEXT_PUBLIC_LOCAL_USERID || 'necall').trim();
export const LOCAL_STORE_ID = (process.env.NEXT_PUBLIC_LOCAL_STORE_ID || 'guest').trim();
export const REMOTE_API_URL = (process.env.NEXT_PUBLIC_REMOTE_API_URL || 'https://admin.necall.com').trim();

export function storeSiteBase(userid: string, storeId: string) {
  return `/s/${encodeURIComponent(userid)}/${encodeURIComponent(storeId)}`;
}

export function storeSiteSetting(userid: string, storeId: string) {
  return `${storeSiteBase(userid, storeId)}/setting`;
}

export function storeApiBase(userid: string, storeId: string) {
  return `/api/store/${encodeURIComponent(userid)}/${encodeURIComponent(storeId)}`;
}

export function platformPath(sub = '') {
  const p = sub.startsWith('/') ? sub : sub ? `/${sub}` : '';
  return `/platform${p}`;
}

export function localStoreSettingPath(): string {
  return storeSiteSetting(LOCAL_USERID, LOCAL_STORE_ID);
}

/** @deprecated use userid — alias for migration */
export function storeSiteBaseLegacy(agentId: string, storeId: string) {
  return storeSiteBase(agentId, storeId);
}
