'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Menu } from '@/src/lib/types';
import { createStoreApi } from '@/src/lib/storeApiScoped';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';
import { hostAuth } from '@/src/lib/hostAuth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTrash, faImages, faSpinner, faInbox } from '@fortawesome/free-solid-svg-icons';
import { uploadManager } from '@/src/lib/uploadManager';
import { useStoreEvents } from '@/src/lib/useStoreEvents';

export default function MenuDetailClient({
  agentId,
  storeId,
  menuId,
}: {
  agentId: string;
  storeId: string;
  menuId: string;
}) {
  const router = useRouter();
  const scopedApi = useMemo(() => createStoreApi(agentId, storeId), [agentId, storeId]);
  const backHref = storeSiteSetting(agentId, storeId);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMenu = async () => {
    try {
      const data = await scopedApi.getMenu(menuId);
      setMenu(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '메뉴를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void hostAuth.autoLoginLocal().catch(() => {});
    if (menuId) void loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId, router]);

  useEffect(() => {
    return uploadManager.onPostProcess((task, result) => {
      if (task.purpose !== 'menuResource') return;
      if (task.payload?.menuId !== menuId) return;
      if (result && typeof result === 'object' && '_id' in (result as Menu)) {
        setMenu(result as Menu);
      } else {
        void loadMenu();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  useStoreEvents(agentId, storeId, {
    onChanged: (evt) => {
      if (evt.entity === 'menus') void loadMenu();
    },
    onUploadDone: () => {
      void loadMenu();
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    try {
      const base = menu?.resources?.length || 0;
      if ('showOpenFilePicker' in window) {
        await uploadManager.pickFilesAndEnqueue({
          purpose: 'menuResource',
          payload: { agentId, storeId, menuId, order: base },
          multiple: true,
        });
      } else {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const arr = Array.from(files);
        for (let i = 0; i < arr.length; i++) {
          await uploadManager.enqueueFile(arr[i], {
            purpose: 'menuResource',
            payload: { agentId, storeId, menuId, order: base + i },
          });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteResource = async (index: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await scopedApi.deleteMenuResource(menuId, index);
      await loadMenu();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-red-500">메뉴를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link href={backHref} className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Store 상세</span>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{menu.name}</h1>
          {menu.description && <p className="text-gray-400">{menu.description}</p>}
        </div>

        {error && <div className="bg-red-800 text-white p-3 rounded-md mb-6">{error}</div>}

        <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faImages} />
            <span>리소스 관리</span>
          </h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">파일 업로드 (이미지 또는 영상)</label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
            />
            {uploading && (
              <p className="mt-2 text-sm text-gray-400 flex items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
                <span>업로드 중...</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {menu.resources && menu.resources.length > 0 ? (
              menu.resources.map((resource, index) => (
                <div key={index} className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors bg-gray-750">
                  {resource.type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resource.url} alt={resource.filename} className="w-full h-40 object-cover rounded-md mb-2" />
                  ) : (
                    <video src={resource.url} controls className="w-full h-40 object-cover rounded-md mb-2" />
                  )}
                  <div className="text-xs text-gray-400 mb-2">
                    <p className="font-medium truncate text-white">{resource.filename}</p>
                    <p>{(resource.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => handleDeleteResource(index)}
                    className="w-full px-3 py-1 text-xs text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                    <span>삭제</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-400">
                <FontAwesomeIcon icon={faInbox} className="text-4xl mb-4 block" />
                <p>등록된 리소스가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
