'use client';

import { useEffect, useMemo, useState } from 'react';
import { uploadManager, UploadTask } from '@/src/lib/uploadManager';

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtPct(p: number) {
  if (!Number.isFinite(p)) return '0%';
  return `${Math.floor(p * 100)}%`;
}

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function UploadQueue() {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    void uploadManager.init();
    return uploadManager.subscribe(setTasks);
  }, []);

  const activeCount = useMemo(
    () => tasks.filter((t) => ['queued', 'uploading', 'paused', 'failed', 'postprocess_failed', 'needs_file_reselect'].includes(t.status)).length,
    [tasks]
  );

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[380px] max-w-[calc(100vw-2rem)]">
      <div className="bg-gray-950/80 backdrop-blur border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="text-sm font-semibold text-gray-100">업로드 큐</div>
          <div className="text-xs text-gray-400">
            {activeCount}개 {open ? '접기' : '펼치기'}
          </div>
        </button>

        {open && (
          <div className="max-h-[50vh] overflow-auto border-t border-gray-800">
            <div className="p-3 space-y-2">
              {tasks.slice(0, 20).map((t) => (
                <div key={t.id} className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-100 truncate">{t.filename}</div>
                      <div className="mt-1 text-xs text-gray-400">
                        {t.fileType.toUpperCase()} · {fmtBytes(t.bytesUploaded)} / {fmtBytes(t.bytesTotal)} · {fmtPct(t.progress)}
                        {t.speedBps ? ` · ${fmtBytes(t.speedBps)}/s` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {t.status === 'uploading' ? (
                        <button
                          className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
                          onClick={() => uploadManager.pause(t.id)}
                        >
                          일시정지
                        </button>
                      ) : t.status === 'paused' ? (
                        <button
                          className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
                          onClick={() => void uploadManager.tryResume(t.id)}
                        >
                          재개
                        </button>
                      ) : t.status === 'needs_file_reselect' ? (
                        <button
                          className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
                          onClick={() => void uploadManager.reselectAndResume(t.id)}
                        >
                          파일 선택 후 재개
                        </button>
                      ) : null}

                      {t.status !== 'completed' && t.status !== 'cancelled' ? (
                        <button
                          className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
                          onClick={() => uploadManager.cancel(t.id)}
                        >
                          취소
                        </button>
                      ) : (
                        <button
                          className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
                          onClick={() => void uploadManager.remove(t.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="h-2 bg-gray-800 rounded">
                      <div className="h-2 bg-blue-600/70 rounded" style={{ width: `${Math.floor(t.progress * 100)}%` }} />
                    </div>
                  </div>

                  {t.error ? (
                    <div className={cls('mt-2 text-xs', t.status === 'failed' || t.status === 'postprocess_failed' ? 'text-red-300' : 'text-gray-400')}>
                      {t.error}
                    </div>
                  ) : null}
                </div>
              ))}

              {tasks.length > 20 ? <div className="text-xs text-gray-500 px-1">최근 20개만 표시 중</div> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

