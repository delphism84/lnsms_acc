'use client';

import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DidStoreDevicesClient from '@/app/did/stores/DidStoreDevicesClient';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';

function first(v: string | null) {
  return v || '';
}

export default function StoreDeviceDidClient() {
  const params = useParams();
  const sp = useSearchParams();

  const agentId = String(params.agentId || '');
  const storeId = String(params.storeId || '');
  const storeRef = useMemo(
    () => first(sp.get('storeRef')) || first(sp.get('storeid')),
    [sp]
  );

  if (!agentId || !storeId) {
    return <div className="p-6 text-gray-400">agentId/storeId 경로가 필요합니다.</div>;
  }

  const backHref = storeSiteSetting(agentId, storeId, storeRef || undefined);

  return (
    <DidStoreDevicesClient
      storeRef={storeRef || ''}
      agentId={agentId}
      storeId={storeId}
      backHref={backHref}
      backLabel="← Store 관리"
      categoryFilter="did"
    />
  );
}
