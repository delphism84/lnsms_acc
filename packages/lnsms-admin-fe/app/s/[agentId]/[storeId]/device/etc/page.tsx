import { Suspense } from 'react';
import StoreDeviceCategoryClient from '@/app/components/store/StoreDeviceCategoryClient';

export const dynamic = 'force-dynamic';

export default function StoreDeviceEtcPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">로딩 중...</div>}>
      <StoreDeviceCategoryClient category="etc" />
    </Suspense>
  );
}
