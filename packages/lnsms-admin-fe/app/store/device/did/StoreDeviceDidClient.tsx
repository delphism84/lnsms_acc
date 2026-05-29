'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import DidStoreDevicesClient from '@/app/did/stores/DidStoreDevicesClient';

function first(v: string | null) {
  return v || '';
}

export default function StoreDeviceDidClient() {
  const sp = useSearchParams();

  const storeRef = useMemo(() => first(sp.get('storeRef')) || first(sp.get('storeid')), [sp]);
  const agentId = useMemo(() => first(sp.get('agentid')) || first(sp.get('agentId')), [sp]);
  const storeId = useMemo(() => first(sp.get('userid')) || first(sp.get('storeId')), [sp]);

  if (!storeRef) {
    return <div className="p-6 text-gray-400">DID 화면을 열기 위한 storeRef가 없습니다.</div>;
  }

  const backHref =
    agentId && storeId ? `/store/setting?agentid=${encodeURIComponent(agentId)}&userid=${encodeURIComponent(storeId)}&storeRef=${encodeURIComponent(storeRef)}` : '/store/setting';

  return <DidStoreDevicesClient storeRef={storeRef} backHref={backHref} backLabel="← Store 관리" />;
}

