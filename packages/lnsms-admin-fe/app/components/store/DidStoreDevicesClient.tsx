'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ensureStoreAccess } from '@/src/lib/storeAccess';
import type { Eqid, Store } from '@/src/lib/types';
import { createStoreApi } from '@/src/lib/storeApiScoped';
import { useStoreEvents } from '@/src/lib/useStoreEvents';
import DeviceDidModal from '@/app/components/DeviceDidModal';

function countTypes(d: Eqid) {
  const images = (d.resources || []).filter((r) => r.type === 'image').length;
  const videos = (d.resources || []).filter((r) => r.type === 'video').length;
  return { images, videos, total: images + videos };
}

function firstThumb(d: Eqid) {
  const r = (d.resources || [])[0];
  if (!r) return null;
  return r;
}

export default function DidStoreDevicesClient({
  storeRef,
  agentId = '',
  storeId = '',
  backHref = '/platform',
  backLabel = '← Store 목록',
  categoryFilter,
  titleOverride,
  descriptionOverride,
}: {
  storeRef: string;
  agentId?: string;
  storeId?: string;
  backHref?: string;
  backLabel?: string;
  categoryFilter?: 'localserver' | 'did' | 'kds' | 'callbell' | 'etc';
  titleOverride?: string;
  descriptionOverride?: string;
}) {
  const router = useRouter();
  const scopedApi = useMemo(
    () => (agentId && storeId ? createStoreApi(agentId, storeId) : null),
    [agentId, storeId]
  );

  const [store, setStore] = useState<Store | null>(null);
  const [devices, setDevices] = useState<Eqid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Eqid | null>(null);

  const title = useMemo(() => {
    const label = titleOverride || (categoryFilter ? categoryFilter.toUpperCase() : 'Device');
    if (!store) return `${label} · Device`;
    const sid = store.storeId || store.userid;
    const uid = store.agentId || store.agentid || agentId;
    return `${label} · Device — ${uid}/${sid} · ${store.name}`;
  }, [store, categoryFilter, titleOverride, agentId]);

  const description =
    descriptionOverride || '해당 매장의 장치ID(Device ID) 리소스/옵션을 관리합니다.';

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!scopedApi) {
        throw new Error('agentId/storeId가 필요합니다.');
      }
      const ctx = await scopedApi.getContext();
      const s = ctx.store;
      let ds = await scopedApi.listEqids();
      if (categoryFilter) {
        ds = ds.filter((d) => (d.category || 'etc') === categoryFilter);
      }
      setStore(s);
      setDevices(ds);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureStoreAccess(agentId, storeId);
      } catch {
        if (!cancelled) {
          setError('로그인이 필요합니다');
          router.push('/login');
          return;
        }
      }
      if (!scopedApi && !storeRef) return;
      if (!cancelled) void load();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeRef, scopedApi, router]);

  useStoreEvents(agentId, storeId, {
    onChanged: (evt) => {
      if (evt.entity === 'devices') void load();
    },
  });

  const handleDeviceUpdated = (updated: Eqid) => {
    setDevices((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
    setSelected(updated);
  };

  if (loading) {
    return <div className="p-6 text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{title}</h1>
          <p className="text-gray-400 text-sm mt-1">{description}</p>
        </div>
        <div className="shrink-0">
          <Link href={backHref} className="text-sm text-blue-300 hover:text-blue-200">
            {backLabel}
          </Link>
        </div>
      </div>

      {error && <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded-md mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-white font-semibold">Device 목록</div>
              <button onClick={load} className="px-3 py-2 rounded-md text-sm border border-gray-700 text-gray-200 hover:bg-gray-750">
                새로고침
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="mt-4 text-gray-400 text-sm">
                등록된 장치ID(Device ID)가 없습니다. (매장 상세 화면에서 장치ID를 먼저 추가하세요)
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {devices.map((d) => {
                  const c = countTypes(d);
                  const t = firstThumb(d);
                  return (
                    <button
                      key={d._id}
                      onClick={() => setSelected(d)}
                      className="text-left bg-gray-950/20 border border-gray-800 hover:border-blue-600/60 rounded-lg overflow-hidden"
                    >
                      <div className="h-40 bg-gray-900 border-b border-gray-800 flex items-center justify-center overflow-hidden">
                        {!t ? (
                          <div className="text-gray-500 text-sm">No thumbnail</div>
                        ) : t.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.url} alt={t.filename} className="w-full h-full object-cover" />
                        ) : (
                          <video src={t.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-white font-semibold truncate">{d.deviceId || d.eqid}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              이미지 {c.images} · 영상 {c.videos} · 총 {c.total}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">{d.enabled ? 'Enabled' : 'Disabled'}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <DeviceDidModal
          device={selected}
          agentId={agentId}
          storeId={storeId}
          onClose={() => setSelected(null)}
          onUpdated={handleDeviceUpdated}
        />
      )}
    </div>
  );
}
