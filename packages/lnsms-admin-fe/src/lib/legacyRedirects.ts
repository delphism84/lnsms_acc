import { storeSiteBase, storeSiteSetting } from './storeScopePaths';

export type LegacyDeviceSegment = 'did' | 'localserver' | 'kds' | 'callbell' | 'etc';

export function resolveLegacyStoreQuery(q: {
  agentid?: string | null;
  agentId?: string | null;
  userid?: string | null;
  storeId?: string | null;
  storeRef?: string | null;
  storeid?: string | null;
}) {
  const agentId = (q.agentId || q.agentid || '').trim();
  const storeId = (q.storeId || q.userid || '').trim();
  const storeRef = (q.storeRef || q.storeid || '').trim();
  return { agentId, storeId, storeRef };
}

export function legacyToStoreSetting(agentId: string, storeId: string, _storeRef?: string) {
  return storeSiteSetting(agentId, storeId);
}

export function legacyToStoreDevice(agentId: string, storeId: string, segment: LegacyDeviceSegment, storeRef?: string) {
  const base = `${storeSiteBase(agentId, storeId)}/device/${segment}`;
  if (!storeRef) return base;
  return `${base}?storeRef=${encodeURIComponent(storeRef)}`;
}
