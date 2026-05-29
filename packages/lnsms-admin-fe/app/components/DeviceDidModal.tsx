'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eqid, eqidApi } from '@/src/lib/api';
import { createStoreApi } from '@/src/lib/storeApiScoped';
import { uploadManager } from '@/src/lib/uploadManager';

type Props = {
  device: Eqid;
  agentId?: string;
  storeId?: string;
  onClose: () => void;
  onUpdated: (updated: Eqid) => void;
};

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function normalizeMs(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(1000, Math.floor(n));
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

export default function DeviceDidModal({ device, agentId = '', storeId = '', onClose, onUpdated }: Props) {
  const scoped = agentId && storeId ? createStoreApi(agentId, storeId) : null;
  const [tab, setTab] = useState<'resources' | 'options'>('resources');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialOptions = useMemo(
    () => ({
      loop: device.didOptions?.loop ?? true,
      shuffle: device.didOptions?.shuffle ?? false,
      fitMode: device.didOptions?.fitMode ?? 'contain',
      mute: device.didOptions?.mute ?? true,
      offlineCache: device.didOptions?.offlineCache ?? true,
      wifiOnlySync: device.didOptions?.wifiOnlySync ?? false,
      maxCacheMb: device.didOptions?.maxCacheMb ?? 512,
    }),
    [device.didOptions]
  );

  const [options, setOptions] = useState(initialOptions);
  useEffect(() => setOptions(initialOptions), [initialOptions]);

  const handleOptionsSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const updated = scoped
        ? await scoped.updateEqid(device._id, { didOptions: options })
        : await eqidApi.update(device._id, { didOptions: options });
      onUpdated(updated);
    } catch (e: any) {
      setError(e?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      // 크롬 계열에서는 파일 핸들을 저장해 새로고침 후에도 자동 재개 가능
      if ('showOpenFilePicker' in window) {
        await uploadManager.pickFilesAndEnqueue({
          purpose: 'eqidResource',
          payload: {
            agentId: agentId || undefined,
            storeId: storeId || undefined,
            eqidId: device._id,
            displayTime: device.displayTime || 5000,
            order: device.resources?.length || 0,
          },
          multiple: true,
        });
      } else {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const base = device.resources?.length || 0;
        const arr = Array.from(files);
        for (let i = 0; i < arr.length; i++) {
          await uploadManager.enqueueFile(arr[i], {
            purpose: 'eqidResource',
            payload: {
              agentId: agentId || undefined,
              storeId: storeId || undefined,
              eqidId: device._id,
              displayTime: device.displayTime || 5000,
              order: base + i,
            },
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleResourceUpdate = async (idx: number, patch: { enabled?: boolean; displayTime?: number; fadeInOut?: boolean }) => {
    try {
      setError(null);
      const updated = scoped
        ? await scoped.updateEqidResource(device._id, idx, patch)
        : await eqidApi.updateResource(device._id, idx, patch);
      onUpdated(updated);
    } catch (e: any) {
      setError(e?.message || '리소스 수정에 실패했습니다.');
    }
  };

  const handleResourceDelete = async (idx: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      setError(null);
      const updated = scoped
        ? await scoped.deleteEqidResource(device._id, idx)
        : await eqidApi.deleteResource(device._id, idx);
      onUpdated(updated);
    } catch (e: any) {
      setError(e?.message || '리소스 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-gray-400">장치ID(Device ID)</div>
            <div className="text-xl font-bold text-white truncate">{device.deviceId || device.eqid}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('resources')}
              className={cls(
                'px-3 py-2 rounded-md text-sm border',
                tab === 'resources' ? 'bg-blue-600/15 border-blue-500 text-blue-200' : 'border-gray-700 text-gray-300 hover:bg-gray-800'
              )}
            >
              리소스
            </button>
            <button
              onClick={() => setTab('options')}
              className={cls(
                'px-3 py-2 rounded-md text-sm border',
                tab === 'options' ? 'bg-blue-600/15 border-blue-500 text-blue-200' : 'border-gray-700 text-gray-300 hover:bg-gray-800'
              )}
            >
              DID 옵션
            </button>
            <button onClick={onClose} className="px-3 py-2 rounded-md text-sm border border-gray-700 text-gray-300 hover:bg-gray-800">
              닫기
            </button>
          </div>
        </div>

        {error && <div className="px-5 py-3 bg-red-900/40 border-b border-red-800 text-red-200 text-sm">{error}</div>}

        {tab === 'resources' ? (
          <div className="p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="text-sm text-gray-400">
                첨부 이미지/동영상, 개별 표시시간(ms), Fade-In/Out, 활성화 여부를 관리합니다.
              </div>
              <div className="flex items-center gap-2">
                <label className={cls('px-3 py-2 rounded-md text-sm border cursor-pointer', uploading ? 'border-gray-800 text-gray-500' : 'border-gray-700 text-gray-200 hover:bg-gray-800')}>
                  {uploading ? '업로드 중...' : '파일 업로드'}
                  <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(device.resources || []).length === 0 ? (
                <div className="text-gray-400 text-sm border border-gray-800 rounded-lg p-4">등록된 리소스가 없습니다.</div>
              ) : (
                device.resources.map((r, idx) => (
                  <div key={`${r.filename}-${idx}`} className="border border-gray-800 rounded-lg p-3 bg-gray-950/20">
                    <div className="flex gap-3">
                      <div className="w-40 h-24 shrink-0 rounded-md overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                        {r.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.url} alt={r.filename} className="w-full h-full object-cover" />
                        ) : (
                          <video src={r.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-white font-semibold truncate">{r.filename}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {r.type.toUpperCase()} · {Math.round((r.size || 0) / 1024)} KB · order {r.order ?? idx}
                            </div>
                          </div>
                          <button onClick={() => handleResourceDelete(idx)} className="text-sm text-red-300 hover:text-red-200">
                            삭제
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={r.enabled !== undefined ? r.enabled : true}
                              onChange={(e) => handleResourceUpdate(idx, { enabled: e.target.checked })}
                            />
                            활성
                          </label>

                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <span className="w-24 text-gray-400">표시(ms)</span>
                            <input
                              type="number"
                              min={1000}
                              step={500}
                              defaultValue={r.displayTime ?? device.displayTime ?? 5000}
                              onBlur={(e) => {
                                const ms = normalizeMs(e.target.value);
                                if (ms !== undefined) handleResourceUpdate(idx, { displayTime: ms });
                              }}
                              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white"
                            />
                          </label>

                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={!!r.fadeInOut}
                              onChange={(e) => handleResourceUpdate(idx, { fadeInOut: e.target.checked })}
                            />
                            Fade-In/Out
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="text-sm text-gray-400 mb-4">
              아래 옵션은 **deviceId(EQID) 단위 설정**이며, 동일 EQID로 로그인한 안드로이드 기기들은 같은 설정으로 동기화되어 동일하게 동작합니다.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input type="checkbox" checked={options.loop} onChange={(e) => setOptions((s) => ({ ...s, loop: e.target.checked }))} />
                반복 재생(Loop)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input type="checkbox" checked={options.shuffle} onChange={(e) => setOptions((s) => ({ ...s, shuffle: e.target.checked }))} />
                랜덤 재생(Shuffle)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input type="checkbox" checked={options.mute} onChange={(e) => setOptions((s) => ({ ...s, mute: e.target.checked }))} />
                영상 음소거(Mute)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={options.offlineCache}
                  onChange={(e) => setOptions((s) => ({ ...s, offlineCache: e.target.checked }))}
                />
                오프라인 캐시 사용
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={options.wifiOnlySync}
                  onChange={(e) => setOptions((s) => ({ ...s, wifiOnlySync: e.target.checked }))}
                />
                Wi-Fi에서만 동기화(앱 적용)
              </label>

              <label className="text-sm text-gray-200">
                <div className="text-gray-400 mb-1">화면 채움(Fit)</div>
                <select
                  value={options.fitMode}
                  onChange={(e) => setOptions((s) => ({ ...s, fitMode: e.target.value as 'contain' | 'cover' }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                >
                  <option value="contain">Contain (전체 보이기)</option>
                  <option value="cover">Cover (꽉 채우기)</option>
                </select>
              </label>

              <label className="text-sm text-gray-200">
                <div className="text-gray-400 mb-1">최대 캐시(MB, 앱 적용)</div>
                <input
                  type="number"
                  min={64}
                  step={64}
                  value={options.maxCacheMb}
                  onChange={(e) => setOptions((s) => ({ ...s, maxCacheMb: Math.max(64, Number(e.target.value || 0)) }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-md border border-gray-700 text-gray-200 hover:bg-gray-800">
                취소
              </button>
              <button
                onClick={handleOptionsSave}
                disabled={saving}
                className={cls('px-4 py-2 rounded-md text-white', saving ? 'bg-blue-700/50' : 'bg-blue-600 hover:bg-blue-700')}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

