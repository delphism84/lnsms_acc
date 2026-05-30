'use client';

import { useParams } from 'next/navigation';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';
import StoreWsConnector from '@/app/components/store/StoreWsConnector';

export default function StoreSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const userid = String(params.agentId || LOCAL_USERID);
  const storeId = String(params.storeId || LOCAL_STORE_ID);

  return (
    <div className="min-h-full flex flex-col">
      <StoreWsConnector userid={userid} storeId={storeId} />
      <div className="shrink-0 border-b border-gray-800 bg-gray-950/50 px-4 py-2 text-sm text-gray-400">
        StoreKey <span className="text-white">{userid}.{storeId}</span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
