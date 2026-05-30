'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { platformPath, storeSiteBase } from '@/src/lib/storeScopePaths';
import type { Store, Category, Menu, Eqid } from '@/src/lib/types';
import { createStoreApi } from '@/src/lib/storeApiScoped';
import { auth } from '@/src/lib/auth';
import { hostAuth } from '@/src/lib/hostAuth';
import { useStoreEvents } from '@/src/lib/useStoreEvents';
import StoreServerSyncPanel from '@/app/components/StoreServerSyncPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faEdit,
  faTrash,
  faFolder,
  faUtensils,
  faStore,
  faClock,
  faToggleOn,
  faToggleOff,
  faImages,
  faSpinner,
  faInbox,
  faKey,
} from '@fortawesome/free-solid-svg-icons';

export default function StoreDetailClient({ agentId, storeId }: { agentId: string; storeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isStoreSite = pathname.startsWith('/s/');
  const scopedApi = useMemo(() => createStoreApi(agentId, storeId), [agentId, storeId]);
  const agentListHref = platformPath();
  const menuBasePath = storeSiteBase(agentId, storeId);

  const [store, setStore] = useState<Store | null>(null);
  const [eqids, setEqids] = useState<Eqid[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  // Store 수정 모달
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showStorePasswordModal, setShowStorePasswordModal] = useState(false);
  const [storeForm, setStoreForm] = useState({
    name: '',
    description: '',
    manager: {
      name: '',
      phone: '',
      email: '',
    },
    contact: {
      phoneMain: '',
      phoneAlt: '',
      fax: '',
      emailMain: '',
      emailAlt: '',
      website: '',
      kakaoChannel: '',
      instagram: '',
      facebook: '',
      naverPlace: '',
      naverBlog: '',
      youtube: '',
    },
    location: {
      address1: '',
      address2: '',
      postalCode: '',
      city: '',
      region: '',
      country: 'KR',
      floor: '',
      unit: '',
      directions: '',
      parkingInfo: '',
      mapUrl: '',
      imageUrl: '',
      lat: null as number | null,
      lng: null as number | null,
    },
    business: {
      legalName: '',
      brandName: '',
      ceoName: '',
      bizNo: '',
      bizType: '',
      bizItem: '',
      openingDate: '',
    },
    operations: {
      timezone: 'Asia/Seoul',
      hoursText: '',
      breakTimeText: '',
      lastOrderText: '',
      holidayText: '',
    },
    services: {
      dineIn: true,
      takeout: true,
      delivery: false,
      reservation: false,
      catering: false,
      driveThru: false,
      kidsFriendly: false,
      petFriendly: false,
      wheelchairAccessible: false,
    },
    facilities: {
      parking: false,
      wifi: false,
      restroom: true,
      smokingArea: false,
      babyChair: false,
      powerOutlet: false,
      seatsCount: null as number | null,
    },
    billing: {
      taxEmail: '',
      invoiceName: '',
      invoicePhone: '',
      invoiceAddress1: '',
      invoiceAddress2: '',
      bankName: '',
      bankAccount: '',
      bankHolder: '',
      vatIncluded: true,
      serviceChargePct: 0,
      currency: 'KRW',
    },
    branding: {
      logoUrl: '',
      coverImageUrl: '',
      interiorImageUrls: [] as string[],
      themeColor: '',
      notice: '',
    },
    integration: {
      posVendor: '',
      posVersion: '',
      terminalCount: null as number | null,
      networkType: '',
      localServerIp: '',
      memo: '',
    },
    status: {
      active: true,
      suspended: false,
      suspendReason: '',
    },
    tags: [] as string[],
    memoInternal: '',
  });
  const [storePw, setStorePw] = useState('');

  // EQID 모달
  const [showEqidModal, setShowEqidModal] = useState(false);
  const [editingEqid, setEditingEqid] = useState<Eqid | null>(null);
  const [eqidForm, setEqidForm] = useState({
    eqid: '',
    displayTime: 5000,
    enabled: true,
  });

  // EQID 리소스 관리
  const [selectedEqid, setSelectedEqid] = useState<Eqid | null>(null);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resourceStates, setResourceStates] = useState<Record<number, { enabled: boolean; displayTime: number; fadeInOut: boolean }>>({});

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isStoreSite) {
        try {
          await hostAuth.autoLoginLocal();
          if (!cancelled && agentId && storeId) await loadData();
        } catch (error: unknown) {
          if (!cancelled) {
            setError(error instanceof Error ? error.message : '로컬 로그인 실패');
            setLoading(false);
          }
        }
        return;
      }

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }
      if (agentId && storeId) await loadData();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, storeId, isStoreSite, router]);

  useStoreEvents(agentId, storeId, {
    onChanged: () => {
      void loadData();
    },
    onUploadDone: () => {
      void loadData();
    },
  });

  const loadData = async () => {
    try {
      const storeData = await scopedApi.getStore();
      const [eqidsData, categoriesData, menusData] = await Promise.all([
        scopedApi.listEqids(),
        scopedApi.listCategories(),
        scopedApi.listMenus(),
      ]);
      setStore(storeData);
      setEqids(eqidsData);
      setCategories(categoriesData);
      setMenus(menusData);
    } catch (error: any) {
      console.error('데이터 로드 실패:', error);
      setError(error.message || '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await scopedApi.updateStore(storeForm);
      setShowStoreModal(false);
      loadData();
    } catch (error: any) {
      console.error('Store 수정 실패:', error);
      setError(error.message || '수정에 실패했습니다.');
    }
  };

  const handleStorePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await scopedApi.updatePassword(storePw);
      alert('비밀번호가 변경되었습니다.');
      setShowStorePasswordModal(false);
      setStorePw('');
    } catch (error: any) {
      console.error('Store 비밀번호 변경 실패:', error);
      setError(error.message || '비밀번호 변경에 실패했습니다.');
    }
  };

  const handleEqidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingEqid) {
        await scopedApi.updateEqid(editingEqid._id, {
          displayTime: eqidForm.displayTime,
          enabled: eqidForm.enabled,
        });
      } else {
        await scopedApi.createEqid({
          eqid: eqidForm.eqid,
          displayTime: eqidForm.displayTime,
          enabled: eqidForm.enabled,
        });
      }
      setShowEqidModal(false);
      setEditingEqid(null);
      setEqidForm({ eqid: '', displayTime: 5000, enabled: true });
      loadData();
    } catch (error: any) {
      console.error('EQID 저장 실패:', error);
      setError(error.message || '저장에 실패했습니다.');
    }
  };

  const handleEqidDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await scopedApi.deleteEqid(id);
      loadData();
    } catch (error: any) {
      console.error('EQID 삭제 실패:', error);
      setError(error.message || '삭제에 실패했습니다.');
    }
  };

  const handleResourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      if (!selectedEqid) return;
      const base = selectedEqid.resources?.length || 0;

      const { uploadManager } = await import('@/src/lib/uploadManager');
      if ('showOpenFilePicker' in window) {
        await uploadManager.pickFilesAndEnqueue({
          purpose: 'eqidResource',
          payload: {
            agentId,
            storeId,
            eqidId: selectedEqid._id,
            displayTime: selectedEqid.displayTime || 5000,
            order: base,
          },
          multiple: true,
        });
      } else {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const arr = Array.from(files);
        for (let i = 0; i < arr.length; i++) {
          await uploadManager.enqueueFile(arr[i], {
            purpose: 'eqidResource',
            payload: {
              agentId,
              storeId,
              eqidId: selectedEqid._id,
              displayTime: selectedEqid.displayTime || 5000,
              order: base + i,
            },
          });
        }
      }
    } catch (error: any) {
      console.error('리소스 업로드 실패:', error);
      setError(error.message || '리소스 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleResourceDelete = async (eqidId: string, resourceIndex: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await scopedApi.deleteEqidResource(eqidId, resourceIndex);
      loadData();
      // 모달이 열려있으면 업데이트
      if (selectedEqid && selectedEqid._id === eqidId) {
        const updatedEqid = eqids.find((e) => e._id === eqidId);
        if (updatedEqid) {
          setSelectedEqid(updatedEqid);
          const states: Record<number, { enabled: boolean; displayTime: number; fadeInOut: boolean }> = {};
          updatedEqid.resources?.forEach((resource, idx) => {
            states[idx] = {
              enabled: resource.enabled !== undefined ? resource.enabled : true,
              displayTime: resource.displayTime || updatedEqid.displayTime || 5000,
              fadeInOut: resource.fadeInOut || false,
            };
          });
          setResourceStates(states);
        }
      }
    } catch (error: any) {
      console.error('리소스 삭제 실패:', error);
      setError(error.message || '삭제에 실패했습니다.');
    }
  };

  const handleResourceUpdate = async (
    eqidId: string,
    resourceIndex: number,
    updates: { enabled?: boolean; displayTime?: number; fadeInOut?: boolean }
  ) => {
    try {
      await scopedApi.updateEqidResource(eqidId, resourceIndex, updates);
      loadData();
      // 모달이 열려있으면 업데이트
      if (selectedEqid && selectedEqid._id === eqidId) {
        const updatedEqid = eqids.find((e) => e._id === eqidId);
        if (updatedEqid) {
          setSelectedEqid(updatedEqid);
          const states: Record<number, { enabled: boolean; displayTime: number; fadeInOut: boolean }> = {};
          updatedEqid.resources?.forEach((resource, idx) => {
            states[idx] = {
              enabled: resource.enabled !== undefined ? resource.enabled : true,
              displayTime: resource.displayTime || updatedEqid.displayTime || 5000,
              fadeInOut: resource.fadeInOut || false,
            };
          });
          setResourceStates(states);
        }
      }
    } catch (error: any) {
      console.error('리소스 수정 실패:', error);
      setError(error.message || '수정에 실패했습니다.');
    }
  };

  const handleUseResourceFadeInOutChange = async (eqidId: string, checked: boolean) => {
    try {
      await scopedApi.updateEqid(eqidId, { useResourceFadeInOut: checked });
      loadData();
      if (selectedEqid && selectedEqid._id === eqidId) {
        const updatedEqid = eqids.find((e) => e._id === eqidId);
        if (updatedEqid) {
          setSelectedEqid({ ...updatedEqid, useResourceFadeInOut: checked });
        }
      }
    } catch (error: any) {
      console.error('Fade-In/Out 설정 변경 실패:', error);
      setError(error.message || '설정 변경에 실패했습니다.');
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingCategory) {
        await scopedApi.updateCategory(editingCategory._id, categoryForm);
      } else {
        await scopedApi.createCategory(categoryForm);
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', order: 0 });
      loadData();
    } catch (error: any) {
      console.error('카테고리 저장 실패:', error);
      setError(error.message || '저장에 실패했습니다.');
    }
  };

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const categoryId = editingMenu
        ? typeof editingMenu.categoryId === 'string'
          ? editingMenu.categoryId
          : editingMenu.categoryId._id
        : menuForm.categoryId;

      if (!categoryId) {
        setError('카테고리를 선택해주세요.');
        return;
      }

      if (editingMenu) {
        await scopedApi.updateMenu(editingMenu._id, menuForm);
      } else {
        await scopedApi.createMenu({ ...menuForm, categoryId });
      }
      setShowMenuModal(false);
      setEditingMenu(null);
      setMenuForm({ name: '', description: '', price: 0, order: 0, categoryId: '' });
      loadData();
    } catch (error: any) {
      console.error('메뉴 저장 실패:', error);
      setError(error.message || '저장에 실패했습니다.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 연관된 메뉴도 함께 삭제됩니다.')) return;
    try {
      await scopedApi.deleteCategory(id);
      loadData();
    } catch (error: any) {
      console.error('삭제 실패:', error);
      setError(error.message || '삭제에 실패했습니다.');
    }
  };

  const handleDeleteMenu = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await scopedApi.deleteMenu(id);
      loadData();
    } catch (error: any) {
      console.error('삭제 실패:', error);
      setError(error.message || '삭제에 실패했습니다.');
    }
  };

  const toggleEqidEnabled = async (eqid: Eqid) => {
    try {
      await scopedApi.updateEqid(eqid._id, { enabled: !eqid.enabled });
      loadData();
    } catch (error: any) {
      console.error('EQID 상태 변경 실패:', error);
      setError(error.message || '상태 변경에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-red-500">스토어를 찾을 수 없습니다.</p>
      </div>
    );
  }

  // NOTE: 아래 JSX는 기존 /stores/[agentid]/[userid] 페이지의 내용을 그대로 유지합니다.
  // (라우트만 분리해서 /store/setting 등에서도 재사용)
  return (
    <div className="p-6">
      <div className="mb-8 flex items-center">
        <Link href={agentListHref} className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>매장ID(Store ID) 목록</span>
        </Link>
      </div>

      {/* Store 정보 수정 섹션 */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faStore} />
            <span>Store 정보</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStoreForm({
                  name: store.name,
                  description: store.description || '',
                  manager: {
                    name: store.manager?.name || '',
                    phone: store.manager?.phone || '',
                    email: store.manager?.email || '',
                  },
                  contact: {
                    phoneMain: store.contact?.phoneMain || '',
                    phoneAlt: store.contact?.phoneAlt || '',
                    fax: store.contact?.fax || '',
                    emailMain: store.contact?.emailMain || '',
                    emailAlt: store.contact?.emailAlt || '',
                    website: store.contact?.website || '',
                    kakaoChannel: store.contact?.kakaoChannel || '',
                    instagram: store.contact?.instagram || '',
                    facebook: store.contact?.facebook || '',
                    naverPlace: store.contact?.naverPlace || '',
                    naverBlog: store.contact?.naverBlog || '',
                    youtube: store.contact?.youtube || '',
                  },
                  location: {
                    address1: store.location?.address1 || '',
                    address2: store.location?.address2 || '',
                    postalCode: store.location?.postalCode || '',
                    city: store.location?.city || '',
                    region: store.location?.region || '',
                    country: store.location?.country || 'KR',
                    floor: store.location?.floor || '',
                    unit: store.location?.unit || '',
                    directions: store.location?.directions || '',
                    parkingInfo: store.location?.parkingInfo || '',
                    mapUrl: store.location?.mapUrl || '',
                    imageUrl: store.location?.imageUrl || '',
                    lat: store.location?.lat ?? null,
                    lng: store.location?.lng ?? null,
                  },
                  business: {
                    legalName: store.business?.legalName || '',
                    brandName: store.business?.brandName || '',
                    ceoName: store.business?.ceoName || '',
                    bizNo: store.business?.bizNo || '',
                    bizType: store.business?.bizType || '',
                    bizItem: store.business?.bizItem || '',
                    openingDate: store.business?.openingDate || '',
                  },
                  operations: {
                    timezone: store.operations?.timezone || 'Asia/Seoul',
                    hoursText: store.operations?.hoursText || '',
                    breakTimeText: store.operations?.breakTimeText || '',
                    lastOrderText: store.operations?.lastOrderText || '',
                    holidayText: store.operations?.holidayText || '',
                  },
                  services: {
                    dineIn: store.services?.dineIn ?? true,
                    takeout: store.services?.takeout ?? true,
                    delivery: store.services?.delivery ?? false,
                    reservation: store.services?.reservation ?? false,
                    catering: store.services?.catering ?? false,
                    driveThru: store.services?.driveThru ?? false,
                    kidsFriendly: store.services?.kidsFriendly ?? false,
                    petFriendly: store.services?.petFriendly ?? false,
                    wheelchairAccessible: store.services?.wheelchairAccessible ?? false,
                  },
                  facilities: {
                    parking: store.facilities?.parking ?? false,
                    wifi: store.facilities?.wifi ?? false,
                    restroom: store.facilities?.restroom ?? true,
                    smokingArea: store.facilities?.smokingArea ?? false,
                    babyChair: store.facilities?.babyChair ?? false,
                    powerOutlet: store.facilities?.powerOutlet ?? false,
                    seatsCount: store.facilities?.seatsCount ?? null,
                  },
                  billing: {
                    taxEmail: store.billing?.taxEmail || '',
                    invoiceName: store.billing?.invoiceName || '',
                    invoicePhone: store.billing?.invoicePhone || '',
                    invoiceAddress1: store.billing?.invoiceAddress1 || '',
                    invoiceAddress2: store.billing?.invoiceAddress2 || '',
                    bankName: store.billing?.bankName || '',
                    bankAccount: store.billing?.bankAccount || '',
                    bankHolder: store.billing?.bankHolder || '',
                    vatIncluded: store.billing?.vatIncluded ?? true,
                    serviceChargePct: store.billing?.serviceChargePct ?? 0,
                    currency: store.billing?.currency || 'KRW',
                  },
                  branding: {
                    logoUrl: store.branding?.logoUrl || '',
                    coverImageUrl: store.branding?.coverImageUrl || '',
                    interiorImageUrls: store.branding?.interiorImageUrls || [],
                    themeColor: store.branding?.themeColor || '',
                    notice: store.branding?.notice || '',
                  },
                  integration: {
                    posVendor: store.integration?.posVendor || '',
                    posVersion: store.integration?.posVersion || '',
                    terminalCount: store.integration?.terminalCount ?? null,
                    networkType: store.integration?.networkType || '',
                    localServerIp: store.integration?.localServerIp || '',
                    memo: store.integration?.memo || '',
                  },
                  status: {
                    active: store.status?.active ?? true,
                    suspended: store.status?.suspended ?? false,
                    suspendReason: store.status?.suspendReason || '',
                  },
                  tags: store.tags || [],
                  memoInternal: store.memoInternal || '',
                });
                setError(null);
                setShowStoreModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faEdit} />
              <span>수정</span>
            </button>
            <button
              onClick={() => {
                setError(null);
                setStorePw('');
                setShowStorePasswordModal(true);
              }}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faKey} />
              <span>비번 수정</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
          <div>
            <span className="text-gray-400">이름:</span> <span className="text-white font-medium">{store.name}</span>
          </div>
          <div>
            <span className="text-gray-400">에이전트ID(Agent ID):</span>{' '}
            <span className="text-white font-medium">{store.agentId || store.agentid}</span>
          </div>
          <div>
            <span className="text-gray-400">매장ID(Store ID):</span>{' '}
            <span className="text-white font-medium">{store.storeId || store.userid}</span>
          </div>
          {store.description && (
            <div>
              <span className="text-gray-400">설명:</span> <span className="text-white">{store.description}</span>
            </div>
          )}
        </div>
      </div>

      <StoreServerSyncPanel onSynced={loadData} />

      {/* EQID 관리 섹션 */}
      <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faImages} />
            <span>기기 관리</span>
          </h2>
          <button
            onClick={() => {
              setEditingEqid(null);
              setEqidForm({ eqid: '', displayTime: 5000, enabled: true });
              setError(null);
              setShowEqidModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>장치ID(Device ID) 추가</span>
          </button>
        </div>

        {error && <div className="bg-red-800 text-white p-3 rounded-md mb-4">{error}</div>}

        <div className="space-y-4">
          {eqids.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FontAwesomeIcon icon={faInbox} className="text-4xl mb-4 block" />
              <p>등록된 장치ID(Device ID)가 없습니다.</p>
            </div>
          ) : (
            eqids.map((eqid) => (
              <div key={eqid._id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{eqid.deviceId || eqid.eqid}</h3>
                      <button
                        onClick={() => toggleEqidEnabled(eqid)}
                        className={`px-3 py-1 rounded-md text-sm flex items-center gap-2 ${
                          eqid.enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                      >
                        <FontAwesomeIcon icon={eqid.enabled ? faToggleOn : faToggleOff} />
                        <span>{eqid.enabled ? '사용중' : '비활성'}</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faClock} />
                        <span>표시시간: {eqid.displayTime}ms</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faImages} />
                        <span>리소스: {eqid.resources?.length || 0}개</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedEqid(eqid);
                        // 리소스 상태 초기화
                        const states: Record<number, { enabled: boolean; displayTime: number; fadeInOut: boolean }> = {};
                        eqid.resources?.forEach((resource, idx) => {
                          states[idx] = {
                            enabled: resource.enabled !== undefined ? resource.enabled : true,
                            displayTime: resource.displayTime || eqid.displayTime || 5000,
                            fadeInOut: resource.fadeInOut || false,
                          };
                        });
                        setResourceStates(states);
                        setShowResourceModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faImages} />
                      <span>리소스</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingEqid(eqid);
                        setEqidForm({
                          eqid: eqid.eqid || eqid.deviceId || '',
                          displayTime: eqid.displayTime ?? 5000,
                          enabled: eqid.enabled ?? true,
                        });
                        setError(null);
                        setShowEqidModal(true);
                      }}
                      className="px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                      <span>수정</span>
                    </button>
                    <button
                      onClick={() => handleEqidDelete(eqid._id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      <span>삭제</span>
                    </button>
                  </div>
                </div>

                {/* 리소스 미리보기 */}
                {eqid.resources && eqid.resources.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {eqid.resources.slice(0, 4).map((resource, idx) => (
                      <div key={idx} className="relative">
                        {resource.type === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={resource.url} alt={resource.filename} className="w-full h-20 object-cover rounded-md" />
                        ) : (
                          <video src={resource.url} className="w-full h-20 object-cover rounded-md" muted />
                        )}
                      </div>
                    ))}
                    {eqid.resources.length > 4 && (
                      <div className="w-full h-20 bg-gray-600 rounded-md flex items-center justify-center text-gray-400 text-sm">
                        +{eqid.resources.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 카테고리 섹션 */}
      <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700 mb-8">
        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faFolder} /> 카테고리
          </h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '', description: '', order: 0 });
              setError(null);
              setShowCategoryModal(true);
            }}
          >
            <FontAwesomeIcon icon={faPlus} />
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
                        className="text-blue-400 hover:text-blue-300 mr-4"
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryForm({
                            name: category.name,
                            description: category.description || '',
                            order: category.order,
                          });
                          setError(null);
                          setShowCategoryModal(true);
                        }}
                      >
                        <FontAwesomeIcon icon={faEdit} /> 수정
                      </button>
                      <button className="text-red-400 hover:text-red-300" onClick={() => handleDeleteCategory(category._id)}>
                        <FontAwesomeIcon icon={faTrash} /> 삭제
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
      <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faUtensils} /> 메뉴
          </h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            onClick={() => {
              setEditingMenu(null);
              setMenuForm({ name: '', description: '', price: 0, order: 0, categoryId: '' });
              setError(null);
              setShowMenuModal(true);
            }}
          >
            <FontAwesomeIcon icon={faPlus} />
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
                  const categoryName =
                    typeof menu.categoryId === 'string'
                      ? categories.find((c) => c._id === menu.categoryId)?.name || '-'
                      : menu.categoryId.name;
                  return (
                    <tr key={menu._id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{menu.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{categoryName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{menu.price.toLocaleString()}원</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{menu.resources?.length || 0}개</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`${menuBasePath}/menus/${menu._id}`} className="text-blue-400 hover:text-blue-300 mr-4">
                          <FontAwesomeIcon icon={faEdit} /> 상세
                        </Link>
                        <button onClick={() => handleDeleteMenu(menu._id)} className="text-red-400 hover:text-red-300">
                          <FontAwesomeIcon icon={faTrash} /> 삭제
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

      {/* Store 수정 모달 */}
      {showStoreModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-6"
          onClick={() => setShowStoreModal(false)}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl w-[95vw] sm:w-full max-w-4xl border border-gray-700 max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Store 정보 수정</h2>
            </div>
            <form onSubmit={handleStoreSubmit} className="flex-1 min-h-0 overflow-y-auto app-scrollbar px-4 sm:px-6 py-4 text-sm">
              {/* 기본(항상 노출) */}
              <div className="mb-6">
                <div className="text-sm font-semibold text-gray-200 mb-3">기본</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">이름</label>
                    <input
                      type="text"
                      value={storeForm.name}
                      onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">태그(쉼표로 구분)</label>
                    <input
                      type="text"
                      value={(storeForm.tags || []).join(', ')}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          tags: e.target.value
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 강남, 24시, 테스트"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">설명</label>
                  <textarea
                    value={storeForm.description}
                    onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4" open>
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">담당자</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">이름</label>
                    <input
                      type="text"
                      value={storeForm.manager.name}
                      onChange={(e) => setStoreForm({ ...storeForm, manager: { ...storeForm.manager, name: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">연락처</label>
                    <input
                      type="text"
                      value={storeForm.manager.phone}
                      onChange={(e) => setStoreForm({ ...storeForm, manager: { ...storeForm.manager, phone: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">이메일</label>
                    <input
                      type="email"
                      value={storeForm.manager.email}
                      onChange={(e) => setStoreForm({ ...storeForm, manager: { ...storeForm.manager, email: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">연락처/채널</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      ['대표전화', 'phoneMain'],
                      ['보조전화', 'phoneAlt'],
                      ['팩스', 'fax'],
                      ['대표이메일', 'emailMain'],
                      ['보조이메일', 'emailAlt'],
                      ['웹사이트', 'website'],
                      ['카카오 채널', 'kakaoChannel'],
                      ['인스타그램', 'instagram'],
                      ['페이스북', 'facebook'],
                      ['네이버플레이스', 'naverPlace'],
                      ['네이버블로그', 'naverBlog'],
                      ['유튜브', 'youtube'],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                      <input
                        type="text"
                        value={(storeForm.contact as any)[key] as string}
                        onChange={(e) => setStoreForm({ ...storeForm, contact: { ...storeForm.contact, [key]: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4" open>
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">위치</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">주소</label>
                    <input
                      type="text"
                      value={storeForm.location.address1}
                      onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, address1: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">상세주소</label>
                    <input
                      type="text"
                      value={storeForm.location.address2}
                      onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, address2: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">우편번호</label>
                    <input
                      type="text"
                      value={storeForm.location.postalCode}
                      onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, postalCode: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">도시</label>
                      <input
                        type="text"
                        value={storeForm.location.city}
                        onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, city: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">지역(시/도)</label>
                      <input
                        type="text"
                        value={storeForm.location.region}
                        onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, region: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">국가</label>
                      <input
                        type="text"
                        value={storeForm.location.country}
                        onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, country: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">층</label>
                      <input
                        type="text"
                        value={storeForm.location.floor}
                        onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, floor: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">호수</label>
                      <input
                        type="text"
                        value={storeForm.location.unit}
                        onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, unit: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">안내/찾아오는 길</label>
                    <textarea
                      value={storeForm.location.directions}
                      onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, directions: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">주차 정보</label>
                    <textarea
                      value={storeForm.location.parkingInfo}
                      onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, parkingInfo: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">지도 URL</label>
                    <input
                      type="text"
                      value={storeForm.location.mapUrl}
                      onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, mapUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://map..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">위치 이미지 URL</label>
                    <input
                      type="text"
                      value={storeForm.location.imageUrl}
                      onChange={(e) => setStoreForm({ ...storeForm, location: { ...storeForm.location, imageUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">위도(lat)</label>
                      <input
                        type="number"
                        value={storeForm.location.lat ?? ''}
                        onChange={(e) =>
                          setStoreForm({
                            ...storeForm,
                            location: { ...storeForm.location, lat: e.target.value === '' ? null : Number(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">경도(lng)</label>
                      <input
                        type="number"
                        value={storeForm.location.lng ?? ''}
                        onChange={(e) =>
                          setStoreForm({
                            ...storeForm,
                            location: { ...storeForm.location, lng: e.target.value === '' ? null : Number(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">사업자/기본 사업정보</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      ['상호(법인/사업자명)', 'legalName'],
                      ['브랜드/간판명', 'brandName'],
                      ['대표자명', 'ceoName'],
                      ['사업자등록번호', 'bizNo'],
                      ['업태', 'bizType'],
                      ['종목', 'bizItem'],
                      ['개업일(YYYY-MM-DD)', 'openingDate'],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={key} className={key === 'bizItem' ? 'md:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                      <input
                        type="text"
                        value={(storeForm.business as any)[key] as string}
                        onChange={(e) => setStoreForm({ ...storeForm, business: { ...storeForm.business, [key]: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">운영(영업시간/휴무)</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">타임존</label>
                    <input
                      type="text"
                      value={storeForm.operations.timezone}
                      onChange={(e) => setStoreForm({ ...storeForm, operations: { ...storeForm.operations, timezone: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div />
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">영업시간(자유서술)</label>
                    <textarea
                      value={storeForm.operations.hoursText}
                      onChange={(e) => setStoreForm({ ...storeForm, operations: { ...storeForm.operations, hoursText: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="예: 매일 10:00-22:00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">브레이크타임</label>
                    <textarea
                      value={storeForm.operations.breakTimeText}
                      onChange={(e) => setStoreForm({ ...storeForm, operations: { ...storeForm.operations, breakTimeText: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">라스트오더</label>
                    <textarea
                      value={storeForm.operations.lastOrderText}
                      onChange={(e) => setStoreForm({ ...storeForm, operations: { ...storeForm.operations, lastOrderText: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">휴무</label>
                    <textarea
                      value={storeForm.operations.holidayText}
                      onChange={(e) => setStoreForm({ ...storeForm, operations: { ...storeForm.operations, holidayText: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">서비스/시설</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {(
                      [
                        ['매장식사', ['services', 'dineIn']],
                        ['포장', ['services', 'takeout']],
                        ['배달', ['services', 'delivery']],
                        ['예약', ['services', 'reservation']],
                        ['케이터링', ['services', 'catering']],
                        ['드라이브스루', ['services', 'driveThru']],
                        ['키즈프렌들리', ['services', 'kidsFriendly']],
                        ['펫프렌들리', ['services', 'petFriendly']],
                        ['휠체어 접근', ['services', 'wheelchairAccessible']],
                      ] as const
                    ).map(([label, [, key]]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-200">
                        <input
                          type="checkbox"
                          checked={(storeForm.services as any)[key] as boolean}
                          onChange={(e) =>
                            setStoreForm({
                              ...storeForm,
                              services: { ...storeForm.services, [key]: e.target.checked },
                            })
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(
                      [
                        ['주차', ['facilities', 'parking']],
                        ['와이파이', ['facilities', 'wifi']],
                        ['화장실', ['facilities', 'restroom']],
                        ['흡연구역', ['facilities', 'smokingArea']],
                        ['아기의자', ['facilities', 'babyChair']],
                        ['콘센트', ['facilities', 'powerOutlet']],
                      ] as const
                    ).map(([label, [, key]]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-200">
                        <input
                          type="checkbox"
                          checked={(storeForm.facilities as any)[key] as boolean}
                          onChange={(e) =>
                            setStoreForm({
                              ...storeForm,
                              facilities: { ...storeForm.facilities, [key]: e.target.checked },
                            })
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                    <div className="pt-3">
                      <label className="block text-sm font-medium text-gray-300 mb-2">좌석수</label>
                      <input
                        type="number"
                        value={storeForm.facilities.seatsCount ?? ''}
                        onChange={(e) =>
                          setStoreForm({
                            ...storeForm,
                            facilities: {
                              ...storeForm.facilities,
                              seatsCount: e.target.value === '' ? null : Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">정산/세금계산서</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">세금계산서 이메일</label>
                    <input
                      type="email"
                      value={storeForm.billing.taxEmail}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, taxEmail: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 담당자명</label>
                    <input
                      type="text"
                      value={storeForm.billing.invoiceName}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, invoiceName: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 연락처</label>
                    <input
                      type="text"
                      value={storeForm.billing.invoicePhone}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, invoicePhone: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 주소</label>
                    <input
                      type="text"
                      value={storeForm.billing.invoiceAddress1}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, invoiceAddress1: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 상세주소</label>
                    <input
                      type="text"
                      value={storeForm.billing.invoiceAddress2}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, invoiceAddress2: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">은행</label>
                    <input
                      type="text"
                      value={storeForm.billing.bankName}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, bankName: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">계좌번호</label>
                    <input
                      type="text"
                      value={storeForm.billing.bankAccount}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, bankAccount: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">예금주</label>
                    <input
                      type="text"
                      value={storeForm.billing.bankHolder}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, bankHolder: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-200 md:col-span-3">
                    <input
                      type="checkbox"
                      checked={!!storeForm.billing.vatIncluded}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, vatIncluded: e.target.checked } })}
                    />
                    <span>부가세 포함</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">서비스차지(%)</label>
                    <input
                      type="number"
                      value={storeForm.billing.serviceChargePct}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          billing: { ...storeForm.billing, serviceChargePct: Number(e.target.value || 0) },
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">통화</label>
                    <input
                      type="text"
                      value={storeForm.billing.currency}
                      onChange={(e) => setStoreForm({ ...storeForm, billing: { ...storeForm.billing, currency: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">브랜딩/노출</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">로고 URL</label>
                    <input
                      type="text"
                      value={storeForm.branding.logoUrl}
                      onChange={(e) => setStoreForm({ ...storeForm, branding: { ...storeForm.branding, logoUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">커버 이미지 URL</label>
                    <input
                      type="text"
                      value={storeForm.branding.coverImageUrl}
                      onChange={(e) => setStoreForm({ ...storeForm, branding: { ...storeForm.branding, coverImageUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">인테리어/매장 이미지 URL들(줄바꿈)</label>
                    <textarea
                      value={(storeForm.branding.interiorImageUrls || []).join('\n')}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          branding: {
                            ...storeForm.branding,
                            interiorImageUrls: e.target.value
                              .split('\n')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="https://...\nhttps://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">테마 컬러</label>
                    <input
                      type="text"
                      value={storeForm.branding.themeColor}
                      onChange={(e) => setStoreForm({ ...storeForm, branding: { ...storeForm.branding, themeColor: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="#111827"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">공지(고객 노출 가능)</label>
                    <textarea
                      value={storeForm.branding.notice}
                      onChange={(e) => setStoreForm({ ...storeForm, branding: { ...storeForm.branding, notice: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">연동/장비(메모)</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">POS 벤더</label>
                    <input
                      type="text"
                      value={storeForm.integration.posVendor}
                      onChange={(e) => setStoreForm({ ...storeForm, integration: { ...storeForm.integration, posVendor: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">POS 버전</label>
                    <input
                      type="text"
                      value={storeForm.integration.posVersion}
                      onChange={(e) => setStoreForm({ ...storeForm, integration: { ...storeForm.integration, posVersion: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">단말 수</label>
                    <input
                      type="number"
                      value={storeForm.integration.terminalCount ?? ''}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          integration: { ...storeForm.integration, terminalCount: e.target.value === '' ? null : Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">네트워크 타입</label>
                    <input
                      type="text"
                      value={storeForm.integration.networkType}
                      onChange={(e) => setStoreForm({ ...storeForm, integration: { ...storeForm.integration, networkType: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">로컬서버 IP</label>
                    <input
                      type="text"
                      value={storeForm.integration.localServerIp}
                      onChange={(e) => setStoreForm({ ...storeForm, integration: { ...storeForm.integration, localServerIp: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-300 mb-2">메모</label>
                    <textarea
                      value={storeForm.integration.memo}
                      onChange={(e) => setStoreForm({ ...storeForm, integration: { ...storeForm.integration, memo: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </details>

              <details className="mb-2 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">상태/관리자 메모</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!storeForm.status.active}
                      onChange={(e) => setStoreForm({ ...storeForm, status: { ...storeForm.status, active: e.target.checked } })}
                    />
                    <span>활성</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!storeForm.status.suspended}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          status: { ...storeForm.status, suspended: e.target.checked },
                        })
                      }
                    />
                    <span>정지</span>
                  </label>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">정지 사유</label>
                    <input
                      type="text"
                      value={storeForm.status.suspendReason}
                      onChange={(e) => setStoreForm({ ...storeForm, status: { ...storeForm.status, suspendReason: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">관리자 메모(내부)</label>
                    <textarea
                      value={storeForm.memoInternal}
                      onChange={(e) => setStoreForm({ ...storeForm, memoInternal: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </details>

              {error && <div className="bg-red-800 text-white p-3 rounded-md mb-4">{error}</div>}
              <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  onClick={() => setShowStoreModal(false)}
                >
                  취소
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EQID 추가/수정 모달 */}
      {showEqidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setShowEqidModal(false)}>
          <div
            className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">{editingEqid ? '장치ID(Device ID) 수정' : '장치ID(Device ID) 추가'}</h2>
            </div>
            <form onSubmit={handleEqidSubmit} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">장치ID(Device ID)</label>
                <input
                  type="text"
                  value={eqidForm.eqid}
                  onChange={(e) => setEqidForm({ ...eqidForm, eqid: e.target.value })}
                  required
                  disabled={!!editingEqid}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">표시시간 (ms)</label>
                <input
                  type="number"
                  value={eqidForm.displayTime}
                  onChange={(e) => setEqidForm({ ...eqidForm, displayTime: parseInt(e.target.value) })}
                  required
                  min={1000}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <input
                    type="checkbox"
                    checked={eqidForm.enabled}
                    onChange={(e) => setEqidForm({ ...eqidForm, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span>사용 여부</span>
                </label>
              </div>
              {error && <div className="bg-red-800 text-white p-3 rounded-md mb-4">{error}</div>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    setShowEqidModal(false);
                    setEditingEqid(null);
                  }}
                >
                  취소
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EQID 리소스 관리 모달 */}
      {showResourceModal &&
        selectedEqid &&
        (() => {
          const enabledResources = selectedEqid.resources?.filter((r, idx) => resourceStates[idx]?.enabled !== false) || [];
          const totalTime = enabledResources.reduce((sum, r) => {
            const originalIdx = selectedEqid.resources?.indexOf(r) ?? -1;
            return sum + (resourceStates[originalIdx]?.displayTime || selectedEqid.displayTime || 5000);
          }, 0);

          return (
            <div
              className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
              onClick={() => {
                setShowResourceModal(false);
                setSelectedEqid(null);
                setResourceStates({});
              }}
            >
              <div
                className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FontAwesomeIcon icon={faImages} />
                    <span>장치ID: {selectedEqid.deviceId || selectedEqid.eqid} - 리소스 관리</span>
                  </h2>
                  <button
                    onClick={() => {
                      setShowResourceModal(false);
                      setSelectedEqid(null);
                      setResourceStates({});
                    }}
                    className="text-gray-400 hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="px-6 py-4">
                  {/* 상단 정보 영역 */}
                  <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                    <div className="flex flex-wrap items-center gap-6 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-300">전체 예상 시간:</span>
                        <span className="text-lg font-bold text-white">
                          {totalTime}ms ({(totalTime / 1000).toFixed(1)}초)
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEqid.useResourceFadeInOut || false}
                          onChange={(e) => handleUseResourceFadeInOutChange(selectedEqid._id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">각 리소스별 Fade-In, Fade-Out 사용</span>
                      </label>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">파일 업로드 (이미지 또는 영상)</label>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleResourceUpload}
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
                  </div>

                  {/* 리소스 그리드 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedEqid.resources && selectedEqid.resources.length > 0 ? (
                      selectedEqid.resources.map((resource, index) => {
                        const state = resourceStates[index] || {
                          enabled: resource.enabled !== undefined ? resource.enabled : true,
                          displayTime: resource.displayTime || selectedEqid.displayTime || 5000,
                          fadeInOut: resource.fadeInOut || false,
                        };

                        return (
                          <div key={index} className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors bg-gray-750">
                            {resource.type === 'image' ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={resource.url} alt={resource.filename} className="w-full h-40 object-cover rounded-md mb-3" />
                            ) : (
                              <video src={resource.url} controls className="w-full h-40 object-cover rounded-md mb-3" />
                            )}
                            <div className="text-xs text-gray-400 mb-3">
                              <p className="font-medium truncate text-white mb-1">{resource.filename}</p>
                              <p>{(resource.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>

                            {/* 사용 체크박스 */}
                            <div className="mb-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={state.enabled}
                                  onChange={(e) => {
                                    const newState = { ...state, enabled: e.target.checked };
                                    setResourceStates({ ...resourceStates, [index]: newState });
                                    handleResourceUpdate(selectedEqid._id, index, { enabled: e.target.checked });
                                  }}
                                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-300">사용</span>
                              </label>
                            </div>

                            {/* 표시시간 */}
                            <div className="mb-3">
                              <label className="block text-xs text-gray-400 mb-1">표시시간 (ms)</label>
                              <input
                                type="number"
                                value={state.displayTime}
                                onChange={(e) => {
                                  const newState = { ...state, displayTime: parseInt(e.target.value) || 5000 };
                                  setResourceStates({ ...resourceStates, [index]: newState });
                                }}
                                onBlur={() => {
                                  handleResourceUpdate(selectedEqid._id, index, { displayTime: state.displayTime });
                                }}
                                min={1000}
                                step={100}
                                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            {/* Fade-In/Out 체크박스 */}
                            {selectedEqid.useResourceFadeInOut && (
                              <div className="mb-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={state.fadeInOut}
                                    onChange={(e) => {
                                      const newState = { ...state, fadeInOut: e.target.checked };
                                      setResourceStates({ ...resourceStates, [index]: newState });
                                      handleResourceUpdate(selectedEqid._id, index, { fadeInOut: e.target.checked });
                                    }}
                                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-300">Fade-In/Out</span>
                                </label>
                              </div>
                            )}

                            {/* 저장/삭제 버튼 */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  handleResourceUpdate(selectedEqid._id, index, {
                                    enabled: state.enabled,
                                    displayTime: state.displayTime,
                                    fadeInOut: state.fadeInOut,
                                  });
                                }}
                                className="flex-1 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                              >
                                <FontAwesomeIcon icon={faEdit} />
                                <span>저장</span>
                              </button>
                              <button
                                onClick={() => handleResourceDelete(selectedEqid._id, index)}
                                className="flex-1 px-3 py-1.5 text-xs text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                                <span>삭제</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
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
        })()}

      {/* 카테고리 모달 */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">{editingCategory ? '카테고리 수정' : '카테고리 추가'}</h2>
            </div>
            <form onSubmit={handleCategorySubmit} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">이름</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">설명</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">순서</label>
                <input
                  type="number"
                  value={categoryForm.order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <div className="bg-red-800 text-white p-3 rounded-md mb-4">{error}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors" onClick={() => setShowCategoryModal(false)}>
                  취소
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
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
              <h2 className="text-xl font-semibold text-white">{editingMenu ? '메뉴 수정' : '메뉴 추가'}</h2>
            </div>
            <form onSubmit={handleMenuSubmit} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">카테고리</label>
                <select
                  value={editingMenu ? (typeof editingMenu.categoryId === 'string' ? editingMenu.categoryId : editingMenu.categoryId._id) : menuForm.categoryId}
                  onChange={(e) => setMenuForm({ ...menuForm, categoryId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!!editingMenu}
                >
                  <option value="">선택하세요</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
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
              {error && <div className="bg-red-800 text-white p-3 rounded-md mb-4">{error}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors" onClick={() => setShowMenuModal(false)}>
                  취소
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store 비밀번호 변경 모달 */}
      {showStorePasswordModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setShowStorePasswordModal(false)}
        >
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faKey} />
                <span>Store 비밀번호 변경</span>
              </h2>
            </div>
            <form onSubmit={handleStorePasswordSubmit} className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">에이전트ID(Agent ID)</label>
                <input
                  type="text"
                  value={store.agentId || store.agentid}
                  disabled
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 cursor-not-allowed"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">매장ID(Store ID)</label>
                <input
                  type="text"
                  value={store.storeId || store.userid}
                  disabled
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 cursor-not-allowed"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">새 비밀번호</label>
                <input
                  type="password"
                  value={storePw}
                  onChange={(e) => setStorePw(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="새 비밀번호를 입력하세요"
                />
              </div>
              {error && <div className="bg-red-800 text-white p-3 rounded-md mb-4">{error}</div>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowStorePasswordModal(false);
                    setStorePw('');
                    setError(null);
                  }}
                  className="px-4 py-2 text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                >
                  취소
                </button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                  변경
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

