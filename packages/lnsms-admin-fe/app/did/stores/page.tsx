'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/src/lib/auth';
import { platformApi, type PlatformStore } from '@/src/lib/platformApi';
import { storeSiteBase } from '@/src/lib/storeScopePaths';

function storeLabel(s: PlatformStore) {
  const agentId = s.agentId || s.agentid || '';
  const storeId = s.storeId || s.userid || '';
  return `${agentId} / ${storeId} — ${s.name || ''}`;
}

export default function DidStoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<PlatformStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.push('/login');
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const data = await platformApi.listStores();
        setStores(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Store 목록을 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return stores;
    return stores.filter((s) => storeLabel(s).toLowerCase().includes(qq));
  }, [stores, q]);

  if (loading) {
    return <div className="p-6 text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">DID · Store</h1>
          <p className="text-gray-400 text-sm mt-1">매장을 선택하면 해당 매장의 DID 장치(Device) 목록을 관리합니다.</p>
        </div>
        <div className="w-full max-w-xl">
          <label className="block text-xs text-gray-400 mb-1">검색</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="agentId / storeId / store name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md mb-4">{error}</div>}

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">매장(Store)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                  표시할 Store가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const agentId = s.agentId || s.agentid || '';
                const storeId = s.storeId || s.userid || '';
                const href = `${storeSiteBase(agentId, storeId)}/device/did?storeRef=${encodeURIComponent(s._id)}`;
                return (
                  <tr key={s._id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm text-white">{storeLabel(s)}</td>
                    <td className="px-4 py-3">
                      <Link href={href} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm">
                        Device 보기
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
