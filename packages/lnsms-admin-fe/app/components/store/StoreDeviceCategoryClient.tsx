'use client';

import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DidStoreDevicesClient from '@/app/components/store/DidStoreDevicesClient';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';

export type DeviceCategory = 'localserver' | 'did' | 'kds' | 'callbell' | 'etc';

const META: Record<DeviceCategory, { title: string; description: string }> = {
  localserver: {
    title: '로컬서버 PC',
    description: '로컬서버 PC 장치(Device ID) 리소스를 관리합니다.',
  },
  did: {
    title: 'DID',
    description: 'DID 장치(Device ID) 리소스/옵션을 관리합니다.',
  },
  kds: {
    title: 'KDS',
    description: 'KDS 장치(Device ID) 리소스를 관리합니다.',
  },
  callbell: {
    title: '호출벨',
    description: '호출벨 장치(Device ID) 리소스를 관리합니다.',
  },
  etc: {
    title: '기타',
    description: '기타 장치(Device ID) 리소스를 관리합니다.',
  },
};

function first(v: string | null) {
  return v || '';
}

export default function StoreDeviceCategoryClient({ category }: { category: DeviceCategory }) {
  const params = useParams();
  const sp = useSearchParams();

  const agentId = String(params.agentId || '');
  const storeId = String(params.storeId || '');
  const storeRef = useMemo(() => first(sp.get('storeRef')) || first(sp.get('storeid')), [sp]);
  const meta = META[category];

  if (!agentId || !storeId) {
    return <div className="p-6 text-gray-400">agentId/storeId 경로가 필요합니다.</div>;
  }

  return (
    <DidStoreDevicesClient
      storeRef={storeRef || ''}
      agentId={agentId}
      storeId={storeId}
      backHref={storeSiteSetting(agentId, storeId)}
      backLabel="← Store 관리"
      categoryFilter={category}
      titleOverride={meta.title}
      descriptionOverride={meta.description}
    />
  );
}
