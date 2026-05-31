import StoreSettingClient from '@/app/store/setting/StoreSettingClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ agentId: string; storeId: string }> };

export default async function StoreSiteSettingPage({ params }: Props) {
  const { agentId, storeId } = await params;
  return (
      <Suspense fallback={<div className="store-backup-loading">로딩 중...</div>}>
      <StoreSettingClient agentId={agentId} storeId={storeId} />
    </Suspense>
  );
}
