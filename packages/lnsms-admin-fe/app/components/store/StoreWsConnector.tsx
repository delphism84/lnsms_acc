'use client';

import { useStoreEvents } from '@/src/lib/useStoreEvents';

/** plan D1: /s/... 진입 시 WS connect (로컬 necall.guest는 storeWsClient 내부에서 skip) */
export default function StoreWsConnector({ userid, storeId }: { userid: string; storeId: string }) {
  useStoreEvents(userid, storeId, {});
  return null;
}
