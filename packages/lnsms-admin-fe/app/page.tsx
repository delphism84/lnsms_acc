'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/src/lib/auth';
import { localStoreSettingPath } from '@/src/lib/storeScopePaths';

export default function Home() {
  const router = useRouter();
  const localStorePath = localStoreSettingPath();

  useEffect(() => {
    if (localStorePath) {
      router.replace(localStorePath);
      return;
    }
    if (!auth.isAuthenticated()) {
      router.push('/login');
    }
  }, [router, localStorePath]);

  if (localStorePath) {
    return null;
  }

  if (!auth.isAuthenticated()) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">LNSMS Admin</h1>
        <p className="text-gray-400 mt-1">좌측 트리 메뉴에서 기능을 선택하세요.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/platform"
          className="bg-gray-800 rounded-lg shadow-md p-6 hover:bg-gray-750 border border-gray-700 transition-all hover:border-blue-500"
        >
          <div className="text-4xl mb-4 text-white">
            <i className="fas fa-sitemap"></i>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white">Platform</h2>
          <p className="text-gray-400">전체 매장 · 콘솔 열기 · 동기화</p>
        </Link>

        <Link
          href="/platform"
          className="bg-gray-800 rounded-lg shadow-md p-6 hover:bg-gray-750 border border-gray-700 transition-all hover:border-blue-500"
        >
          <div className="text-4xl mb-4 text-white">
            <i className="fas fa-store"></i>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white">매장 (Platform)</h2>
          <p className="text-gray-400">전체 매장 · sync · 콘솔 열기</p>
        </Link>

        <Link
          href="/did/stores"
          className="bg-gray-800 rounded-lg shadow-md p-6 hover:bg-gray-750 border border-gray-700 transition-all hover:border-blue-500"
        >
          <div className="text-4xl mb-4 text-white">
            <i className="fas fa-tv"></i>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white">DID</h2>
          <p className="text-gray-400">Store별 Device(EQID) 리소스/옵션</p>
        </Link>
      </div>
    </div>
  );
}
