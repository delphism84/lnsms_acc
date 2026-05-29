import StoreDeviceDidClient from './StoreDeviceDidClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default function StoreDeviceDidPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">로딩 중...</div>}>
      <StoreDeviceDidClient />
    </Suspense>
  );
}

