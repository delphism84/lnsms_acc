'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/src/lib/auth';
import { platformPath } from '@/src/lib/storeScopePaths';

/** 레거시 /stores → Platform 매장 관리로 이동 */
export default function StoresPage() {
  const router = useRouter();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.push('/login');
      return;
    }
    router.replace(platformPath());
  }, [router]);

  return <div className="p-6 text-gray-400">Platform으로 이동 중…</div>;
}
