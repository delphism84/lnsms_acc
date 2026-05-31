'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/src/lib/auth';
import { platformApi, type PlatformStore } from '@/src/lib/platformApi';
import { isStoreSite, platformSiteOrigin } from '@/src/lib/siteMode';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';

export default function PlatformPage() {
  const router = useRouter();
  const [stores, setStores] = useState<PlatformStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ userid: '', storeId: '', name: '', password: '', description: '' });

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await platformApi.listStores();
      setStores(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStoreSite()) {
      window.location.replace(`${platformSiteOrigin()}/platform`);
      return;
    }
    if (!auth.isAuthenticated()) {
      router.push('/login');
      return;
    }
    void loadStores();
  }, [loadStores, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('create');
    setError(null);
    try {
      await platformApi.createStore({
        userid: createForm.userid.trim(),
        storeId: createForm.storeId.trim(),
        name: createForm.name.trim(),
        password: createForm.password.trim() || undefined,
        description: createForm.description.trim() || undefined,
      });
      setShowCreate(false);
      setCreateForm({ userid: '', storeId: '', name: '', password: '', description: '' });
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : '매장 생성 실패');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (s: PlatformStore) => {
    if (!window.confirm(`매장 "${s.userid}.${s.storeId}" 및 연관 데이터를 삭제할까요?`)) return;
    setBusy(`delete:${s._id}`);
    setError(null);
    try {
      await platformApi.deleteStore(s._id);
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Platform — 매장 관리</h1>
          <p className="text-gray-400 text-sm">
            매장 콘솔: <code className="text-gray-300">/s/&#123;userid&#125;/&#123;storeId&#125;</code> · sync는 Host 전용.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
        >
          + 매장 추가
        </button>
      </div>

      {loading && <p className="text-gray-400">로딩 중...</p>}
      {error && <p className="text-red-300 mb-4">{error}</p>}

      {!loading && (
        <div className="border border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-4 py-3">userid</th>
                <th className="px-4 py-3">storeId</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">콘솔</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => {
                const href = storeSiteSetting(s.userid, s.storeId);
                return (
                  <tr key={s._id} className="border-t border-gray-800 hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-gray-200">{s.userid}</td>
                    <td className="px-4 py-3 text-gray-200">{s.storeId}</td>
                    <td className="px-4 py-3 text-gray-400">{s.name || '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={href} className="text-blue-300 hover:text-blue-200">
                        매장 콘솔
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busy === `delete:${s._id}`}
                        onClick={() => void handleDelete(s)}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stores.length === 0 && <p className="p-4 text-gray-500">등록된 매장이 없습니다.</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <form
            className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg p-6"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <h2 className="text-lg font-semibold text-white mb-4">매장 추가</h2>
            <label className="block text-sm text-gray-400 mb-1">userid (업체)</label>
            <input
              required
              value={createForm.userid}
              onChange={(e) => setCreateForm((f) => ({ ...f, userid: e.target.value }))}
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            />
            <label className="block text-sm text-gray-400 mb-1">storeId (매장)</label>
            <input
              required
              value={createForm.storeId}
              onChange={(e) => setCreateForm((f) => ({ ...f, storeId: e.target.value }))}
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            />
            <label className="block text-sm text-gray-400 mb-1">이름</label>
            <input
              required
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            />
            <label className="block text-sm text-gray-400 mb-1">Host 비밀번호 (선택)</label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            />
            <label className="block text-sm text-gray-400 mb-1">설명 (선택)</label>
            <input
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full mb-4 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-300 text-sm">
                취소
              </button>
              <button
                type="submit"
                disabled={busy === 'create'}
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
              >
                {busy === 'create' ? '저장 중…' : '생성'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
