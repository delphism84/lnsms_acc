'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';

function first(v: string | null) {
  return v || '';
}

export default function StoreDeviceBackLink({ label = '← Store 관리' }: { label?: string }) {
  const params = useParams();
  const sp = useSearchParams();
  const agentId = String(params.agentId || '');
  const storeId = String(params.storeId || '');
  const storeRef = first(sp.get('storeRef')) || first(sp.get('storeid'));

  const href =
    agentId && storeId ? storeSiteSetting(agentId, storeId, storeRef || undefined) : '/platform';

  return (
    <Link href={href} className="text-blue-300 hover:text-blue-200 text-sm">
      {label}
    </Link>
  );
}
