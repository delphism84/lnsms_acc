'use client';

import { useEffect, useState } from 'react';
import { getClientSiteMode, type SiteMode } from '@/src/lib/siteMode';
import PlatformLoginPage from '@/app/components/PlatformLoginPage';
import StoreLoginPage from '@/app/components/StoreLoginPage';

export default function LoginPage() {
  const [mode, setMode] = useState<SiteMode | null>(null);

  useEffect(() => {
    setMode(getClientSiteMode());
  }, []);

  if (mode === null) return null;

  if (mode === 'store' || mode === 'local') return <StoreLoginPage />;
  return <PlatformLoginPage />;
}
