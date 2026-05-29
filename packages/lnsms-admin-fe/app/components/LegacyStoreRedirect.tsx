'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  legacyToStoreDevice,
  legacyToStoreSetting,
  resolveLegacyStoreQuery,
  type LegacyDeviceSegment,
} from '@/src/lib/legacyRedirects';

type Target = 'setting' | { device: LegacyDeviceSegment };

export default function LegacyStoreRedirect({ target }: { target: Target }) {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const { agentId, storeId, storeRef } = resolveLegacyStoreQuery({
      agentid: sp.get('agentid'),
      agentId: sp.get('agentId'),
      userid: sp.get('userid'),
      storeId: sp.get('storeId'),
      storeRef: sp.get('storeRef'),
      storeid: sp.get('storeid'),
    });
    if (!agentId || !storeId) return;
    const href =
      target === 'setting'
        ? legacyToStoreSetting(agentId, storeId, storeRef || undefined)
        : legacyToStoreDevice(agentId, storeId, target.device, storeRef || undefined);
    router.replace(href);
  }, [router, sp, target]);

  return <div className="p-6 text-gray-400">새 Store URL로 이동 중…</div>;
}
