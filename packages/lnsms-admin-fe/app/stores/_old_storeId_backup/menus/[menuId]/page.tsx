'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { menuApi, uploadApi, Menu, MenuResource } from '@/src/lib/api';

export default function MenuDetailPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const menuId = params.menuId as string;
  
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (menuId) {
      loadMenu();
    }
  }, [menuId]);

  const loadMenu = async () => {
    try {
      const data = await menuApi.getById(menuId);
      setMenu(data);
    } catch (error) {
      console.error('메뉴 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadResult = await uploadApi.uploadSingle(file);
        
        await menuApi.addResource(menuId, {
          type: uploadResult.type as 'image' | 'video',
          url: uploadResult.url,
          filename: uploadResult.filename,
          size: uploadResult.size,
          order: (menu?.resources?.length || 0) + i,
        });
      }
      loadMenu();
      alert('파일 업로드가 완료되었습니다.');
    } catch (error: any) {
      console.error('업로드 실패:', error);
      alert(error.message || '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteResource = async (index: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await menuApi.deleteResource(menuId, index);
      loadMenu();
    } catch (error) {
      console.error('리소스 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
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
        <p className="text-gray-400">메뉴를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const categoryName = typeof menu.categoryId === 'string' ? '-' : menu.categoryId.name;
  const storeName = typeof menu.storeId === 'string' ? '-' : menu.storeId.name;

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link href={`/stores/${storeId}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
            <i className="fas fa-arrow-left"></i>
            <span>스토어 상세</span>
          </Link>
        </div>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{menu.name}</h1>
          <div className="text-gray-400 space-y-1">
            <p>카테고리: {categoryName}</p>
            <p>가격: {menu.price.toLocaleString()}원</p>
            {menu.description && <p>설명: {menu.description}</p>}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <i className="fas fa-images"></i>
            <span>리소스 관리</span>
          </h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              파일 업로드 (이미지 또는 영상)
            </label>
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
                <i className="fas fa-spinner fa-spin"></i>
                <span>업로드 중...</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {menu.resources && menu.resources.length > 0 ? (
              menu.resources.map((resource, index) => (
                <div key={index} className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors bg-gray-750">
                  {resource.type === 'image' ? (
                    <img
                      src={resource.url}
                      alt={resource.filename}
                      className="w-full h-40 object-cover rounded-md mb-2"
                    />
                  ) : (
                    <video
                      src={resource.url}
                      controls
                      className="w-full h-40 object-cover rounded-md mb-2"
                    />
                  )}
                  <div className="text-xs text-gray-400 mb-2">
                    <p className="font-medium truncate text-white">{resource.filename}</p>
                    <p>{(resource.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => handleDeleteResource(index)}
                    className="w-full px-3 py-1 text-xs text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-trash"></i>
                    <span>삭제</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-400">
                <i className="fas fa-inbox text-4xl mb-4 block"></i>
                <p>등록된 리소스가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

