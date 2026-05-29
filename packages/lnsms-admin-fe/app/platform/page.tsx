'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { platformApi, type PlatformStore, type SyncBundle } from '@/src/lib/platformApi';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PlatformPage() {
  const [stores, setStores] = useState<PlatformStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ agentId: '', storeId: '', name: '', description: '' });

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<{ agentId: string; storeId: string } | null>(null);

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
    void loadStores();
  }, [loadStores]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('create');
    setError(null);
    try {
      await platformApi.createStore({
        agentId: createForm.agentId.trim(),
        storeId: createForm.storeId.trim(),
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
      });
      setShowCreate(false);
      setCreateForm({ agentId: '', storeId: '', name: '', description: '' });
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : '매장 생성 실패');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (s: PlatformStore) => {
    const agentId = s.agentId || s.agentid || '';
    const storeId = s.storeId || s.userid || '';
    if (!window.confirm(`매장 "${storeId}" (${agentId}) 및 연관 데이터를 삭제할까요?`)) return;
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

  const handleExport = async (agentId: string, storeId: string) => {
    setBusy(`export:${agentId}:${storeId}`);
    setError(null);
    try {
      const bundle = await platformApi.exportBundle(agentId, storeId);
      downloadJson(`lnsms-sync-${agentId}-${storeId}.json`, bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export 실패');
    } finally {
      setBusy(null);
    }
  };

  const openImport = (agentId: string, storeId: string) => {
    setImportTarget({ agentId, storeId });
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !importTarget) return;
    setBusy(`import:${importTarget.agentId}:${importTarget.storeId}`);
    setError(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as SyncBundle;
      if (!window.confirm(`"${importTarget.storeId}" 매장에 bundle을 replace 모드로 가져올까요?`)) return;
      await platformApi.importBundle(importTarget.agentId, importTarget.storeId, bundle, 'replace');
      alert('Import 완료');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import 실패');
    } finally {
      setBusy(null);
      setImportTarget(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Platform — 매장 관리</h1>
          <p className="text-gray-400 text-sm">
            매장 콘솔은 <code className="text-gray-300">/s/&#123;agentId&#125;/&#123;storeId&#125;</code> · DB 동기화는 export/import JSON.
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

      <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />

      {loading && <p className="text-gray-400">로딩 중...</p>}
      {error && <p className="text-red-300 mb-4">{error}</p>}

      {!loading && (
        <div className="border border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">콘솔</th>
                <th className="px-4 py-3">동기화</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => {
                const agentId = s.agentId || s.agentid || '';
                const storeId = s.storeId || s.userid || '';
                const href = storeSiteSetting(agentId, storeId, s._id);
                const rowBusy = busy?.includes(agentId) && busy?.includes(storeId);
                return (
                  <tr key={s._id} className="border-t border-gray-800 hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-gray-200">{agentId}</td>
                    <td className="px-4 py-3 text-gray-200">{storeId}</td>
                    <td className="px-4 py-3 text-gray-400">{s.name || '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={href} className="text-blue-300 hover:text-blue-200">
                        매장 콘솔
                      </Link>
                    </td>
                    <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void handleExport(agentId, storeId)}
                        className="text-xs text-gray-300 hover:text-white disabled:opacity-40"
                      >
                        {rowBusy && busy?.startsWith('export') ? '…' : 'Export'}
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => openImport(agentId, storeId)}
                        className="text-xs text-gray-300 hover:text-white disabled:opacity-40"
                      >
                        Import
                      </button>
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
            <label className="block text-sm text-gray-400 mb-1">Agent ID</label>
            <input
              required
              value={createForm.agentId}
              onChange={(e) => setCreateForm((f) => ({ ...f, agentId: e.target.value }))}
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white"
            />
            <label className="block text-sm text-gray-400 mb-1">Store ID</label>
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
