'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import StoreDetailClient from '@/app/stores/StoreDetailClient';

function first(v: string | null) {
  return v || '';
}

export default function StoreSettingClient({
  agentId: agentIdProp,
  storeId: storeIdProp,
}: {
  agentId?: string;
  storeId?: string;
} = {}) {
  const sp = useSearchParams();

  const agentId = useMemo(
    () => agentIdProp || first(sp.get('agentid')) || first(sp.get('agentId')),
    [sp, agentIdProp]
  );
  const storeId = useMemo(
    () => storeIdProp || first(sp.get('userid')) || first(sp.get('storeId')),
    [sp, storeIdProp]
  );

  if (!agentId || !storeId) {
    return <div className="p-6 text-gray-400">Store 정보가 없습니다. (agentid/userid query 필요)</div>;
  }

  return <StoreDetailClient agentId={agentId} storeId={storeId} />;
}

