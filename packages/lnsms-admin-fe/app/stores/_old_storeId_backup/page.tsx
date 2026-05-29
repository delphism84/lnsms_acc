'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { storeApi, categoryApi, menuApi, Store, Category, Menu } from '@/src/lib/api';

export default function StoreDetailPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  
  const [store, setStore] = useState<Store | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    order: 0,
  });
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: 0,
    order: 0,
    categoryId: '',
  });

  useEffect(() => {
    if (storeId) {
      loadData();
    }
  }, [storeId]);

  const loadData = async () => {
    try {
      const [storeData, categoriesData, menusData] = await Promise.all([
        storeApi.getById(storeId),
        categoryApi.getByStore(storeId),
        menuApi.getByStore(storeId),
      ]);
      setStore(storeData);
      setCategories(categoriesData);
      setMenus(menusData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await categoryApi.update(editingCategory._id, categoryForm);
      } else {
        await categoryApi.create({ ...categoryForm, storeId });
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', order: 0 });
      loadData();
    } catch (error: any) {
      console.error('카테고리 저장 실패:', error);
      alert(error.message || '저장에 실패했습니다.');
    }
  };

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const categoryId = editingMenu 
        ? (typeof editingMenu.categoryId === 'string' ? editingMenu.categoryId : editingMenu.categoryId._id)
        : menuForm.categoryId;
      
      if (!categoryId) {
        alert('카테고리를 선택해주세요.');
        return;
      }

      if (editingMenu) {
        await menuApi.update(editingMenu._id, menuForm);
      } else {
        await menuApi.create({ ...menuForm, categoryId, storeId });
      }
      setShowMenuModal(false);
      setEditingMenu(null);
      setMenuForm({ name: '', description: '', price: 0, order: 0, categoryId: '' });
      loadData();
    } catch (error: any) {
      console.error('메뉴 저장 실패:', error);
      alert(error.message || '저장에 실패했습니다.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 연관된 메뉴도 함께 삭제됩니다.')) return;
    try {
      await categoryApi.delete(id);
      loadData();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleDeleteMenu = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await menuApi.delete(id);
      loadData();
    } catch (error) {
      console.error('삭제 실패:', error);
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

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">스토어를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link href="/stores" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
            <i className="fas fa-arrow-left"></i>
            <span>스토어 목록</span>
          </Link>
        </div>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{store.name}</h1>
          <div className="text-gray-400 space-y-1">
            <p>Agent ID: {store.agentid}</p>
            <p>User ID: {store.userid}</p>
          </div>
        </div>

        {/* 카테고리 섹션 */}
        <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">카테고리</h2>
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: '', description: '', order: 0 });
                setShowCategoryModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              <span>카테고리 추가</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">설명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">순서</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                      등록된 카테고리가 없습니다.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category._id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{category.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{category.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{category.order}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryForm({
                              name: category.name,
                              description: category.description || '',
                              order: category.order,
                            });
                            setShowCategoryModal(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 mr-4"
                        >
                          <i className="fas fa-edit"></i> 수정
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category._id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <i className="fas fa-trash"></i> 삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 메뉴 섹션 */}
        <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">메뉴</h2>
            <button
              onClick={() => {
                setEditingMenu(null);
                setMenuForm({ name: '', description: '', price: 0, order: 0, categoryId: '' });
                setShowMenuModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              <span>메뉴 추가</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">카테고리</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">가격</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">리소스</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {menus.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                      등록된 메뉴가 없습니다.
                    </td>
                  </tr>
                ) : (
                  menus.map((menu) => {
                    const categoryName = typeof menu.categoryId === 'string' 
                      ? categories.find(c => c._id === menu.categoryId)?.name || '-'
                      : menu.categoryId.name;
                    return (
                      <tr key={menu._id} className="hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{menu.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{categoryName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{menu.price.toLocaleString()}원</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{menu.resources?.length || 0}개</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/stores/${storeId}/menus/${menu._id}`}
                            className="text-blue-400 hover:text-blue-300 mr-4"
                          >
                            <i className="fas fa-eye"></i> 상세
                          </Link>
                          <button
                            onClick={() => handleDeleteMenu(menu._id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <i className="fas fa-trash"></i> 삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 카테고리 모달 */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCategoryModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingCategory ? '카테고리 수정' : '카테고리 추가'}
                </h2>
              </div>
              <form onSubmit={handleCategorySubmit} className="px-6 py-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">순서</label>
                  <input
                    type="number"
                    value={categoryForm.order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 메뉴 모달 */}
        {showMenuModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setShowMenuModal(false)}>
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">
                  {editingMenu ? '메뉴 수정' : '메뉴 추가'}
                </h2>
              </div>
              <form onSubmit={handleMenuSubmit} className="px-6 py-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">카테고리</label>
                  <select
                    value={editingMenu ? (typeof editingMenu.categoryId === 'string' ? editingMenu.categoryId : editingMenu.categoryId._id) : menuForm.categoryId}
                    onChange={(e) => setMenuForm({ ...menuForm, categoryId: e.target.value })}
                    required
                    disabled={!!editingMenu}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-600"
                  >
                    <option value="">선택하세요</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">이름</label>
                  <input
                    type="text"
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">설명</label>
                  <textarea
                    value={menuForm.description}
                    onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">가격</label>
                  <input
                    type="number"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">순서</label>
                  <input
                    type="number"
                    value={menuForm.order}
                    onChange={(e) => setMenuForm({ ...menuForm, order: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMenuModal(false)}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

