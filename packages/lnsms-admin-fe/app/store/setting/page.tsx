import { Suspense } from 'react';
import LegacyStoreRedirect from '@/app/components/LegacyStoreRedirect';

export const dynamic = 'force-dynamic';

export default function StoreSettingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">로딩 중...</div>}>
      <LegacyStoreRedirect target="setting" />
    </Suspense>
  );
}
