'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Store } from '@/src/lib/api';
import { platformApi } from '@/src/lib/platformApi';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';
import { auth } from '@/src/lib/auth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPlus, faEdit, faTrash, faUser } from '@fortawesome/free-solid-svg-icons';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentid as string;
  
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    storeId: '',
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 인증 확인
    if (!auth.isAuthenticated()) {
      router.push('/login');
      return;
    }
    if (agentId) {
      loadStores();
    }
  }, [agentId, router]);

  const loadStores = async () => {
    try {
      const data = await platformApi.listStoresByAgent(agentId);
      setStores(data);
    } catch (error: any) {
      console.error('Store 목록 로드 실패:', error);
      setError(error.message || 'Store 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingStore) {
        await platformApi.updateStore(editingStore._id, { ...formData, agentId, storeId: formData.storeId });
      } else {
        await platformApi.createStore({
          ...formData,
          agentId,
          storeId: formData.storeId,
        });
      }
      setShowModal(false);
      setEditingStore(null);
      setFormData({
        storeId: '',
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
          lat: null,
          lng: null,
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
          seatsCount: null,
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
          interiorImageUrls: [],
          themeColor: '',
          notice: '',
        },
        integration: {
          posVendor: '',
          posVersion: '',
          terminalCount: null,
          networkType: '',
          localServerIp: '',
          memo: '',
        },
        status: {
          active: true,
          suspended: false,
          suspendReason: '',
        },
        tags: [],
        memoInternal: '',
      });
      loadStores();
    } catch (error: any) {
      console.error('저장 실패:', error);
      setError(error.message || '저장에 실패했습니다.');
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      storeId: store.storeId || store.userid,
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
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await platformApi.deleteStore(id);
      loadStores();
    } catch (error: any) {
      console.error('삭제 실패:', error);
      setError(error.message || '삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center">
        <Link href="/platform" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>에이전트ID(Agent ID) 목록</span>
        </Link>
      </div>
        
      <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faUser} />
        <span>에이전트ID(Agent ID): {agentId}</span>
        </h1>
      <p className="text-gray-400 mb-6">매장ID(Store ID) 관리</p>

      {error && (
        <div className="bg-red-800 text-white p-3 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <button
          onClick={() => {
            setEditingStore(null);
            setFormData({
              storeId: '',
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
                lat: null,
                lng: null,
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
                seatsCount: null,
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
                interiorImageUrls: [],
                themeColor: '',
                notice: '',
              },
              integration: {
                posVendor: '',
                posVersion: '',
                terminalCount: null,
                networkType: '',
                localServerIp: '',
                memo: '',
              },
              status: {
                active: true,
                suspended: false,
                suspendReason: '',
              },
              tags: [],
              memoInternal: '',
            });
            setError(null);
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faPlus} />
          <span>매장ID(Store ID) 추가</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">매장ID(Store ID)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">이름</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">설명</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {stores.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                  등록된 매장ID(Store ID)가 없습니다.
                </td>
              </tr>
            ) : (
              stores.map((store) => (
                <tr key={store._id} className="hover:bg-gray-750">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    <Link
                      href={storeSiteSetting(agentId, String(store.storeId || store.userid), store._id)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {store.storeId || store.userid}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{store.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{store.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(store)}
                      className="text-blue-400 hover:text-blue-300 mr-4"
                    >
                      <FontAwesomeIcon icon={faEdit} /> 수정
                    </button>
                    <button
                      onClick={() => handleDelete(store._id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <FontAwesomeIcon icon={faTrash} /> 삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

        {showModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-6"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-gray-800 rounded-lg shadow-xl w-[95vw] sm:w-full max-w-4xl border border-gray-700 max-h-[92vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">
                {editingStore ? '매장ID(Store ID) 수정' : '매장ID(Store ID) 추가'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto app-scrollbar px-4 sm:px-6 py-4 text-sm">
                {/* 기본 */}
                <div className="mb-6">
                  <div className="text-sm font-semibold text-gray-200 mb-3">기본</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">매장ID(Store ID)</label>
                      <input
                        type="text"
                        value={formData.storeId}
                        onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!!editingStore}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">태그(쉼표로 구분)</label>
                      <input
                        type="text"
                        value={(formData.tags || []).join(', ')}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tags: e.target.value
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">이름</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">설명</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>

                {/* 담당자 */}
                <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-200">담당자</summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">이름</label>
                      <input
                        type="text"
                        value={formData.manager.name}
                        onChange={(e) => setFormData({ ...formData, manager: { ...formData.manager, name: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">연락처</label>
                      <input
                        type="text"
                        value={formData.manager.phone}
                        onChange={(e) => setFormData({ ...formData, manager: { ...formData.manager, phone: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">이메일</label>
                      <input
                        type="email"
                        value={formData.manager.email}
                        onChange={(e) => setFormData({ ...formData, manager: { ...formData.manager, email: e.target.value } })}
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
                          value={(formData.contact as any)[key] as string}
                          onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, [key]: e.target.value } })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </details>

                {/* 위치 */}
                <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-200">위치</summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">주소</label>
                      <input
                        type="text"
                        value={formData.location.address1}
                        onChange={(e) => setFormData({ ...formData, location: { ...formData.location, address1: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">상세주소</label>
                      <input
                        type="text"
                        value={formData.location.address2}
                        onChange={(e) => setFormData({ ...formData, location: { ...formData.location, address2: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">우편번호</label>
                      <input
                        type="text"
                        value={formData.location.postalCode}
                        onChange={(e) => setFormData({ ...formData, location: { ...formData.location, postalCode: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">도시</label>
                        <input
                          type="text"
                          value={formData.location.city}
                          onChange={(e) => setFormData({ ...formData, location: { ...formData.location, city: e.target.value } })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">지역(시/도)</label>
                        <input
                          type="text"
                          value={formData.location.region}
                          onChange={(e) => setFormData({ ...formData, location: { ...formData.location, region: e.target.value } })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">국가</label>
                        <input
                          type="text"
                          value={formData.location.country}
                          onChange={(e) => setFormData({ ...formData, location: { ...formData.location, country: e.target.value } })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">층</label>
                        <input
                          type="text"
                          value={formData.location.floor}
                          onChange={(e) => setFormData({ ...formData, location: { ...formData.location, floor: e.target.value } })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">호수</label>
                        <input
                          type="text"
                          value={formData.location.unit}
                          onChange={(e) => setFormData({ ...formData, location: { ...formData.location, unit: e.target.value } })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">안내/찾아오는 길</label>
                      <textarea
                        value={formData.location.directions}
                        onChange={(e) => setFormData({ ...formData, location: { ...formData.location, directions: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">주차 정보</label>
                      <textarea
                        value={formData.location.parkingInfo}
                        onChange={(e) => setFormData({ ...formData, location: { ...formData.location, parkingInfo: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">지도 URL</label>
                      <input
                        type="text"
                        value={formData.location.mapUrl}
                        onChange={(e) => setFormData({ ...formData, location: { ...formData.location, mapUrl: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">위치 이미지 URL</label>
                      <input
                        type="text"
                        value={formData.location.imageUrl}
                        onChange={(e) => setFormData({ ...formData, location: { ...formData.location, imageUrl: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">위도(lat)</label>
                        <input
                          type="number"
                          value={formData.location.lat ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              location: { ...formData.location, lat: e.target.value === '' ? null : Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">경도(lng)</label>
                        <input
                          type="number"
                          value={formData.location.lng ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              location: { ...formData.location, lng: e.target.value === '' ? null : Number(e.target.value) },
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
                          value={(formData.business as any)[key] as string}
                          onChange={(e) => setFormData({ ...formData, business: { ...formData.business, [key]: e.target.value } })}
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
                        value={formData.operations.timezone}
                        onChange={(e) => setFormData({ ...formData, operations: { ...formData.operations, timezone: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div />
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">영업시간(자유서술)</label>
                      <textarea
                        value={formData.operations.hoursText}
                        onChange={(e) => setFormData({ ...formData, operations: { ...formData.operations, hoursText: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">브레이크타임</label>
                      <textarea
                        value={formData.operations.breakTimeText}
                        onChange={(e) => setFormData({ ...formData, operations: { ...formData.operations, breakTimeText: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">라스트오더</label>
                      <textarea
                        value={formData.operations.lastOrderText}
                        onChange={(e) => setFormData({ ...formData, operations: { ...formData.operations, lastOrderText: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">휴무</label>
                      <textarea
                        value={formData.operations.holidayText}
                        onChange={(e) => setFormData({ ...formData, operations: { ...formData.operations, holidayText: e.target.value } })}
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
                            checked={(formData.services as any)[key] as boolean}
                            onChange={(e) => setFormData({ ...formData, services: { ...formData.services, [key]: e.target.checked } })}
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
                            checked={(formData.facilities as any)[key] as boolean}
                            onChange={(e) => setFormData({ ...formData, facilities: { ...formData.facilities, [key]: e.target.checked } })}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                      <div className="pt-3">
                        <label className="block text-sm font-medium text-gray-300 mb-2">좌석수</label>
                        <input
                          type="number"
                          value={formData.facilities.seatsCount ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              facilities: { ...formData.facilities, seatsCount: e.target.value === '' ? null : Number(e.target.value) },
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
                        value={formData.billing.taxEmail}
                        onChange={(e) => setFormData({ ...formData, billing: { ...formData.billing, taxEmail: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">청구 담당자명</label>
                      <input
                        type="text"
                        value={formData.billing.invoiceName}
                        onChange={(e) => setFormData({ ...formData, billing: { ...formData.billing, invoiceName: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">청구 연락처</label>
                      <input
                        type="text"
                        value={formData.billing.invoicePhone}
                        onChange={(e) => setFormData({ ...formData, billing: { ...formData.billing, invoicePhone: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">은행</label>
                      <input
                        type="text"
                        value={formData.billing.bankName}
                        onChange={(e) => setFormData({ ...formData, billing: { ...formData.billing, bankName: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">계좌번호</label>
                      <input
                        type="text"
                        value={formData.billing.bankAccount}
                        onChange={(e) => setFormData({ ...formData, billing: { ...formData.billing, bankAccount: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">예금주</label>
                      <input
                        type="text"
                        value={formData.billing.bankHolder}
                        onChange={(e) => setFormData({ ...formData, billing: { ...formData.billing, bankHolder: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-200 md:col-span-3">
                      <input
                        type="checkbox"
                        checked={!!formData.billing.vatIncluded}
                        onChange={(e) => setFormData({ ...formData, billing: { ...formData.billing, vatIncluded: e.target.checked } })}
                      />
                      <span>부가세 포함</span>
                    </label>
                  </div>
                </details>

                <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-200">브랜딩/노출</summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">로고 URL</label>
                      <input
                        type="text"
                        value={formData.branding.logoUrl}
                        onChange={(e) => setFormData({ ...formData, branding: { ...formData.branding, logoUrl: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">커버 이미지 URL</label>
                      <input
                        type="text"
                        value={formData.branding.coverImageUrl}
                        onChange={(e) => setFormData({ ...formData, branding: { ...formData.branding, coverImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">인테리어/매장 이미지 URL들(줄바꿈)</label>
                      <textarea
                        value={(formData.branding.interiorImageUrls || []).join('\n')}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branding: {
                              ...formData.branding,
                              interiorImageUrls: e.target.value
                                .split('\n')
                                .map((x) => x.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">테마 컬러</label>
                      <input
                        type="text"
                        value={formData.branding.themeColor}
                        onChange={(e) => setFormData({ ...formData, branding: { ...formData.branding, themeColor: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">공지(고객 노출 가능)</label>
                      <textarea
                        value={formData.branding.notice}
                        onChange={(e) => setFormData({ ...formData, branding: { ...formData.branding, notice: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
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
                        value={formData.integration.posVendor}
                        onChange={(e) => setFormData({ ...formData, integration: { ...formData.integration, posVendor: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">POS 버전</label>
                      <input
                        type="text"
                        value={formData.integration.posVersion}
                        onChange={(e) => setFormData({ ...formData, integration: { ...formData.integration, posVersion: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">단말 수</label>
                      <input
                        type="number"
                        value={formData.integration.terminalCount ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            integration: { ...formData.integration, terminalCount: e.target.value === '' ? null : Number(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">네트워크 타입</label>
                      <input
                        type="text"
                        value={formData.integration.networkType}
                        onChange={(e) => setFormData({ ...formData, integration: { ...formData.integration, networkType: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">로컬서버 IP</label>
                      <input
                        type="text"
                        value={formData.integration.localServerIp}
                        onChange={(e) => setFormData({ ...formData, integration: { ...formData.integration, localServerIp: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-300 mb-2">메모</label>
                      <textarea
                        value={formData.integration.memo}
                        onChange={(e) => setFormData({ ...formData, integration: { ...formData.integration, memo: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
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
                        checked={!!formData.status.active}
                        onChange={(e) => setFormData({ ...formData, status: { ...formData.status, active: e.target.checked } })}
                      />
                      <span>활성</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={!!formData.status.suspended}
                        onChange={(e) => setFormData({ ...formData, status: { ...formData.status, suspended: e.target.checked } })}
                      />
                      <span>정지</span>
                    </label>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">정지 사유</label>
                      <input
                        type="text"
                        value={formData.status.suspendReason}
                        onChange={(e) => setFormData({ ...formData, status: { ...formData.status, suspendReason: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">관리자 메모(내부)</label>
                      <textarea
                        value={formData.memoInternal}
                        onChange={(e) => setFormData({ ...formData, memoInternal: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    </div>
                  </div>
                </details>
                {error && (
                  <div className="bg-red-800 text-white p-3 rounded-md mb-4">
                    {error}
                  </div>
                )}
                <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingStore(null);
                      setError(null);
                    }}
                    className="px-4 py-2 text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    취소
                  </button>
                  <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

