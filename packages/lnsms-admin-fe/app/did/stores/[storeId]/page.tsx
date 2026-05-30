'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { platformApi } from '@/src/lib/platformApi';
import { storeSiteBase } from '@/src/lib/storeScopePaths';

/** 레거시 /did/stores/:mongoId → /s/.../device/did */
export default function LegacyDidStorePage() {
  const params = useParams();
  const router = useRouter();
  const mongoId = String(params.storeId || '');

  useEffect(() => {
    if (!mongoId) return;
    (async () => {
      try {
        const s = await platformApi.getStore(mongoId);
        const agentId = s.userid || '';
        const storeId = s.storeId || '';
        if (!agentId || !storeId) return;
        router.replace(`${storeSiteBase(agentId, storeId)}/device/did?storeRef=${encodeURIComponent(mongoId)}`);
      } catch {
        router.replace('/platform');
      }
    })();
  }, [mongoId, router]);

  return <div className="p-6 text-gray-400">DID 화면으로 이동 중…</div>;
}
