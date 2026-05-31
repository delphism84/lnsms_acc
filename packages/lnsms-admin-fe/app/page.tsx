'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/src/lib/auth';
import { hostAuth } from '@/src/lib/hostAuth';
import { getClientSiteMode } from '@/src/lib/siteMode';
import { localStoreSettingPath, storeSiteSetting } from '@/src/lib/storeScopePaths';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const mode = getClientSiteMode();

    if (mode === 'local') {
      router.replace(localStoreSettingPath());
      return;
    }

    if (mode === 'store') {
      if (hostAuth.isAuthenticated()) {
        const key = hostAuth.getStoreKey();
        if (key) {
          const [userid, storeId] = key.split('.');
          if (userid && storeId) {
            router.replace(storeSiteSetting(userid, storeId));
            return;
          }
        }
      }
      router.replace('/login');
      return;
    }

    if (auth.isAuthenticated()) {
      router.replace('/platform');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
