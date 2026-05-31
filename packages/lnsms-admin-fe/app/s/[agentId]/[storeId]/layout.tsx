'use client';

import { useParams } from 'next/navigation';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';
import StoreWsConnector from '@/app/components/store/StoreWsConnector';
import StoreSiteAuthGuard from '@/app/components/StoreSiteAuthGuard';

export default function StoreSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const userid = String(params.agentId || LOCAL_USERID);
  const storeId = String(params.storeId || LOCAL_STORE_ID);

  return (
    <StoreSiteAuthGuard userid={userid} storeId={storeId}>
      <div className="min-h-full flex flex-col">
        <StoreWsConnector userid={userid} storeId={storeId} />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </StoreSiteAuthGuard>
  );
}
