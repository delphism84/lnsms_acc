'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureStoreAccess } from '@/src/lib/storeAccess';
import { isPlatformSite, isStoreSite } from '@/src/lib/siteMode';

type Props = {
  userid: string;
  storeId: string;
  children: React.ReactNode;
};

export default function StoreSiteAuthGuard({ userid, storeId, children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureStoreAccess(userid, storeId);
        if (!cancelled) setAllowed(true);
      } catch {
        if (cancelled) return;
        if (isStoreSite() || isPlatformSite()) {
          router.replace('/login');
          return;
        }
        router.replace('/login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, userid, storeId]);

  if (!allowed) return null;
  return <>{children}</>;
}
