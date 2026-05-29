// 운영(도메인)에서는 NEXT_PUBLIC_API_URL을 사용하고,
// - https 접속(운영/nginx 프록시)은 동일 origin의 `/api`를 사용 (포트 붙이지 않음)
// - http 접속(로컬/개발)은 `${host}:40000` 백엔드로 직접 호출하도록 폴백합니다.
const API_URL = (() => {
  const explicit = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (explicit) {
    // 운영에서 실수로 https://<host>:40000 를 넣으면 40000은 TLS가 아니라 ERR_SSL_PROTOCOL_ERROR가 발생함
    // → 이 경우 포트를 제거하고 동일 origin(https://<host>)으로 보정
    try {
      const u = new URL(explicit);
      if (u.protocol === 'https:' && u.port === '40000') {
        u.port = '';
        return u.toString().replace(/\/$/, '');
      }
    } catch {
      // ignore - fallback below
    }
    return explicit;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // https(운영/nginx): /api는 같은 도메인으로 프록시되어 있음
    if (protocol === 'https:') return `${protocol}//${hostname}`;
    // http(로컬/개발): 백엔드 포트로 직접 호출
    return `${protocol}//${hostname}:40000`;
  }
  return '';
})();

export interface Agent {
  agentId: string;
  // 호환
  agentid?: string;
  name?: string;
  description?: string;
  manager?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  contact?: {
    phoneMain?: string;
    phoneAlt?: string;
    fax?: string;
    emailMain?: string;
    emailAlt?: string;
    website?: string;
    kakaoChannel?: string;
    instagram?: string;
    facebook?: string;
    naverPlace?: string;
    naverBlog?: string;
    youtube?: string;
  };
  location?: {
    address1?: string;
    address2?: string;
    postalCode?: string;
    city?: string;
    region?: string;
    country?: string;
    floor?: string;
    unit?: string;
    directions?: string;
    parkingInfo?: string;
    mapUrl?: string;
    imageUrl?: string;
    lat?: number | null;
    lng?: number | null;
  };
  business?: {
    legalName?: string;
    brandName?: string;
    ceoName?: string;
    bizNo?: string;
    bizType?: string;
    bizItem?: string;
    openingDate?: string;
  };
  operations?: {
    timezone?: string;
    hoursText?: string;
    breakTimeText?: string;
    lastOrderText?: string;
    holidayText?: string;
  };
  services?: {
    supportHoursText?: string;
    supportChannelText?: string;
  };
  billing?: {
    taxEmail?: string;
    invoiceName?: string;
    invoicePhone?: string;
    invoiceAddress1?: string;
    invoiceAddress2?: string;
    bankName?: string;
    bankAccount?: string;
    bankHolder?: string;
    vatIncluded?: boolean;
    serviceChargePct?: number;
    currency?: string;
  };
  branding?: {
    logoUrl?: string;
    coverImageUrl?: string;
    interiorImageUrls?: string[];
    themeColor?: string;
    notice?: string;
  };
  integration?: {
    memo?: string;
  };
  status?: {
    active?: boolean;
    suspended?: boolean;
    suspendReason?: string;
  };
  tags?: string[];
  memoInternal?: string;
}

export interface Store {
  _id: string;
  agentId?: string;
  storeId?: string;
  // 호환
  agentid: string;
  userid: string;
  eqid?: string;
  name: string;
  description?: string;
  manager?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  contact?: {
    phoneMain?: string;
    phoneAlt?: string;
    fax?: string;
    emailMain?: string;
    emailAlt?: string;
    website?: string;
    kakaoChannel?: string;
    instagram?: string;
    facebook?: string;
    naverPlace?: string;
    naverBlog?: string;
    youtube?: string;
  };
  location?: {
    address1?: string;
    address2?: string;
    postalCode?: string;
    city?: string;
    region?: string;
    country?: string;
    floor?: string;
    unit?: string;
    directions?: string;
    parkingInfo?: string;
    mapUrl?: string;
    imageUrl?: string;
    lat?: number | null;
    lng?: number | null;
  };
  business?: {
    legalName?: string;
    brandName?: string;
    ceoName?: string;
    bizNo?: string;
    bizType?: string;
    bizItem?: string;
    openingDate?: string;
  };
  operations?: {
    timezone?: string;
    hoursText?: string;
    breakTimeText?: string;
    lastOrderText?: string;
    holidayText?: string;
  };
  services?: {
    dineIn?: boolean;
    takeout?: boolean;
    delivery?: boolean;
    reservation?: boolean;
    catering?: boolean;
    driveThru?: boolean;
    kidsFriendly?: boolean;
    petFriendly?: boolean;
    wheelchairAccessible?: boolean;
  };
  facilities?: {
    parking?: boolean;
    wifi?: boolean;
    restroom?: boolean;
    smokingArea?: boolean;
    babyChair?: boolean;
    powerOutlet?: boolean;
    seatsCount?: number | null;
  };
  billing?: {
    taxEmail?: string;
    invoiceName?: string;
    invoicePhone?: string;
    invoiceAddress1?: string;
    invoiceAddress2?: string;
    bankName?: string;
    bankAccount?: string;
    bankHolder?: string;
    vatIncluded?: boolean;
    serviceChargePct?: number;
    currency?: string;
  };
  branding?: {
    logoUrl?: string;
    coverImageUrl?: string;
    interiorImageUrls?: string[];
    themeColor?: string;
    notice?: string;
  };
  integration?: {
    posVendor?: string;
    posVersion?: string;
    terminalCount?: number | null;
    networkType?: string;
    localServerIp?: string;
    memo?: string;
  };
  status?: {
    active?: boolean;
    suspended?: boolean;
    suspendReason?: string;
  };
  tags?: string[];
  memoInternal?: string;
  // 레거시(화면에서는 미사용)
  slideConfig?: {
    interval: number;
    transition: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  storeId: string;
  name: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuResource {
  type: 'image' | 'video';
  url: string;
  filename: string;
  size: number;
  order: number;
  uploadedAt: string;
}

export interface Menu {
  _id: string;
  categoryId: string | Category;
  storeId: string | Store;
  name: string;
  description?: string;
  price: number;
  order: number;
  resources: MenuResource[];
  createdAt: string;
  updatedAt: string;
}

// Auth API
export const authApi = {
  updatePassword: async (agentId: string, pw: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/auth/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, agentid: agentId, pw }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || '비밀번호 변경에 실패했습니다.');
    }
  },
};

// Agent(에이전트/aget) API
export const agentApi = {
  get: async (agentId: string): Promise<Agent> => {
    const res = await fetch(`${API_URL}/api/agents/${encodeURIComponent(agentId)}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || error.error || '에이전트 정보를 불러올 수 없습니다.');
    }
    return res.json();
  },
  update: async (agentId: string, payload: Partial<Agent> & Record<string, any>): Promise<Agent> => {
    const res = await fetch(`${API_URL}/api/agents/${encodeURIComponent(agentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || error.error || '에이전트 정보 저장에 실패했습니다.');
    }
    return res.json();
  },
  delete: async (agentId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || error.error || '에이전트 삭제에 실패했습니다.');
    }
  },
};

// Admin Auth API
export interface AdminUser {
  _id: string;
  username: string;
  role: string;
  createdAt: string;
}

export interface AdminAuthResponse {
  message: string;
  token: string;
  user: AdminUser;
}

export const adminAuthApi = {
  login: async (username: string, password: string): Promise<AdminAuthResponse> => {
    const res = await fetch(`${API_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || '로그인에 실패했습니다.');
    }
    return res.json();
  },
  verify: async (token: string): Promise<{ valid: boolean; user: AdminUser }> => {
    const res = await fetch(`${API_URL}/api/admin/auth/verify`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
    });
    if (!res.ok) {
      throw new Error('토큰 검증에 실패했습니다.');
    }
    return res.json();
  },
};

// Store API (Agent ID 기준)
export const storeApi = {
  // 모든 Agent ID 조회
  getAllAgents: async (): Promise<Agent[]> => {
    // 표준: /api/agents
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      if (res.ok) return res.json();
      // 404 등 실패 시 레거시로 폴백
    } catch {
      // ignore
    }

    // 레거시(운영/구버전 호환): /api/stores 가 agent 목록을 반환
    const resLegacy = await fetch(`${API_URL}/api/stores`);
    if (!resLegacy.ok) {
      throw new Error('Agent 목록을 불러올 수 없습니다.');
    }
    const data = await resLegacy.json();
    // normalize 형태: {agentId} 또는 {agentid}
    return (data || [])
      .map((a: any) => ({ agentId: a.agentId || a.agentid, agentid: a.agentId || a.agentid }))
      .filter((a: any) => !!a.agentId);
  },
  // 모든 Store 조회 (DID/관리화면용)
  getAllStores: async (): Promise<Store[]> => {
    const res = await fetch(`${API_URL}/api/stores/all`);
    if (res.ok) return res.json();

    // 백엔드 버전/환경에 따라 /api/stores/all 이 없거나(404) 오류가 날 수 있어 폴백을 둡니다.
    // 폴백: /api/stores(agents) + /api/stores/agent/:agentid 를 합쳐 전체 Store 리스트 구성
    try {
      const agents = await storeApi.getAllAgents();
      const agentIds = (agents || [])
        .map((a) => a.agentId || a.agentid)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const storesByAgent = await Promise.all(agentIds.map((id) => storeApi.getByAgent(id)));
      return storesByAgent.flat();
    } catch {
      // ignore - 아래에서 공통 에러 처리
    }

    throw new Error('Store 목록을 불러올 수 없습니다.');
  },
  // 특정 Agent ID의 모든 Store 조회 (User ID 목록)
  getByAgent: async (agentId: string): Promise<Store[]> => {
    const res = await fetch(`${API_URL}/api/stores/agent/${agentId}`);
    if (!res.ok) {
      throw new Error('Store 목록을 불러올 수 없습니다.');
    }
    return res.json();
  },
  getById: async (id: string): Promise<Store> => {
    const res = await fetch(`${API_URL}/api/stores/${id}`);
    if (!res.ok) {
      throw new Error('Store를 찾을 수 없습니다.');
    }
    return res.json();
  },
  // 표준: agentId + storeId
  getByAgentAndStore: async (agentId: string, storeId: string): Promise<Store> => {
    const res = await fetch(`${API_URL}/api/stores/agent/${agentId}/store/${storeId}`);
    if (!res.ok) {
      throw new Error('Store를 찾을 수 없습니다.');
    }
    return res.json();
  },
  // 레거시: agentid + userid
  getByAgentAndUser: async (agentid: string, userid: string): Promise<Store> => {
    const res = await fetch(`${API_URL}/api/stores/agent/${agentid}/user/${userid}`);
    if (!res.ok) {
      throw new Error('Store를 찾을 수 없습니다.');
    }
    return res.json();
  },
  create: async (data: Partial<Store>): Promise<Store> => {
    // 표준 필드 동기화
    const agentId = (data as any).agentId || (data as any).agentid;
    const storeId = (data as any).storeId || (data as any).userid;
    const res = await fetch(`${API_URL}/api/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, agentId, agentid: agentId, storeId, userid: storeId }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Store 생성에 실패했습니다.');
    }
    return res.json();
  },
  update: async (id: string, data: Partial<Store>): Promise<Store> => {
    const agentId = (data as any).agentId || (data as any).agentid;
    const storeId = (data as any).storeId || (data as any).userid;
    const res = await fetch(`${API_URL}/api/stores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, agentId, agentid: agentId, storeId, userid: storeId }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Store 수정에 실패했습니다.');
    }
    return res.json();
  },
  updatePassword: async (id: string, pw: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/stores/${id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pw, userpw: pw }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || error.error || '비밀번호 변경에 실패했습니다.');
    }
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/stores/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Store 삭제에 실패했습니다.');
    }
  },
};

// Device API (표준)
export interface DeviceResource {
  type: 'image' | 'video';
  url: string;
  filename: string;
  size: number;
  order: number;
  enabled?: boolean;
  displayTime?: number;
  fadeInOut?: boolean;
  uploadedAt: string;
}

export interface Device {
  _id: string;
  agentId?: string;
  storeId?: string;
  deviceId?: string;
  // 카테고리(없으면 etc로 간주)
  category?: 'localserver' | 'did' | 'kds' | 'callbell' | 'etc';
  // 호환
  eqid?: string;
  storeRef?: any;
  resources: DeviceResource[];
  displayTime: number;
  enabled: boolean;
  useResourceFadeInOut?: boolean;
  didOptions?: {
    loop?: boolean;
    shuffle?: boolean;
    fitMode?: 'contain' | 'cover';
    mute?: boolean;
    offlineCache?: boolean;
    wifiOnlySync?: boolean;
    maxCacheMb?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export const deviceApi = {
  getByStoreRef: async (storeRef: string): Promise<Device[]> => {
    const res = await fetch(`${API_URL}/api/devices/store/${storeRef}`);
    if (!res.ok) throw new Error('Device 목록을 불러올 수 없습니다.');
    return res.json();
  },
  getByAgent: async (agentId: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/api/devices/agent/${agentId}`);
    if (!res.ok) throw new Error('Device 목록을 불러올 수 없습니다.');
    return res.json();
  },
  getByDeviceId: async (deviceId: string): Promise<Device> => {
    const res = await fetch(`${API_URL}/api/devices/${deviceId}`);
    if (!res.ok) throw new Error('Device를 찾을 수 없습니다.');
    return res.json();
  },
  create: async (data: { deviceId: string; storeRef: string; displayTime?: number; enabled?: boolean }): Promise<Device> => {
    const res = await fetch(`${API_URL}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Device 생성에 실패했습니다.');
    }
    return res.json();
  },
};

// Category API
export const categoryApi = {
  getByStore: async (storeId: string): Promise<Category[]> => {
    const res = await fetch(`${API_URL}/api/categories/store/${storeId}`);
    return res.json();
  },
  getById: async (id: string): Promise<Category> => {
    const res = await fetch(`${API_URL}/api/categories/${id}`);
    return res.json();
  },
  create: async (data: Partial<Category>): Promise<Category> => {
    const res = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  update: async (id: string, data: Partial<Category>): Promise<Category> => {
    const res = await fetch(`${API_URL}/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/api/categories/${id}`, {
      method: 'DELETE',
    });
  },
};

// Menu API
export const menuApi = {
  getByCategory: async (categoryId: string): Promise<Menu[]> => {
    const res = await fetch(`${API_URL}/api/menus/category/${categoryId}`);
    return res.json();
  },
  getByStore: async (storeId: string): Promise<Menu[]> => {
    const res = await fetch(`${API_URL}/api/menus/store/${storeId}`);
    return res.json();
  },
  getById: async (id: string): Promise<Menu> => {
    const res = await fetch(`${API_URL}/api/menus/${id}`);
    return res.json();
  },
  create: async (data: Partial<Menu>): Promise<Menu> => {
    const res = await fetch(`${API_URL}/api/menus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  update: async (id: string, data: Partial<Menu>): Promise<Menu> => {
    const res = await fetch(`${API_URL}/api/menus/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/api/menus/${id}`, {
      method: 'DELETE',
    });
  },
  addResource: async (id: string, resource: Partial<MenuResource>): Promise<Menu> => {
    const res = await fetch(`${API_URL}/api/menus/${id}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    });
    return res.json();
  },
  deleteResource: async (id: string, resourceIndex: number): Promise<Menu> => {
    const res = await fetch(`${API_URL}/api/menus/${id}/resources/${resourceIndex}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};

// EQID API
export interface EqidResource {
  type: 'image' | 'video';
  url: string;
  filename: string;
  size: number;
  order: number;
  enabled?: boolean;
  displayTime?: number;
  fadeInOut?: boolean;
  uploadedAt: string;
}

export interface Eqid {
  _id: string;
  // 표준 필드명
  agentId?: string;
  storeId?: string; // Store ID(문자열)
  deviceId?: string;
  // 카테고리(없으면 etc로 간주)
  category?: 'localserver' | 'did' | 'kds' | 'callbell' | 'etc';

  // 레거시/호환
  eqid: string; // 과거 deviceId
  storeRef?: string | Store; // 과거 storeId(ObjectId)
  storeIdLegacy?: string;

  resources: EqidResource[];
  displayTime: number;
  enabled: boolean;
  useResourceFadeInOut?: boolean;
  didOptions?: {
    loop?: boolean;
    shuffle?: boolean;
    fitMode?: 'contain' | 'cover';
    mute?: boolean;
    offlineCache?: boolean;
    wifiOnlySync?: boolean;
    maxCacheMb?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export const eqidApi = {
  getByStore: async (storeId: string): Promise<Eqid[]> => {
    const res = await fetch(`${API_URL}/api/eqids/store/${storeId}`);
    if (!res.ok) {
      throw new Error('EQID 목록을 불러올 수 없습니다.');
    }
    return res.json();
  },
  getByEqid: async (eqid: string): Promise<Eqid> => {
    const res = await fetch(`${API_URL}/api/eqids/${eqid}`);
    if (!res.ok) {
      throw new Error('EQID를 찾을 수 없습니다.');
    }
    return res.json();
  },
  create: async (data: Partial<Eqid>): Promise<Eqid> => {
    const res = await fetch(`${API_URL}/api/eqids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'EQID 생성에 실패했습니다.');
    }
    return res.json();
  },
  update: async (id: string, data: Partial<Eqid>): Promise<Eqid> => {
    const res = await fetch(`${API_URL}/api/eqids/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'EQID 수정에 실패했습니다.');
    }
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/eqids/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('EQID 삭제에 실패했습니다.');
    }
  },
  deleteByStoreAndCategory: async (
    storeRef: string,
    category: 'localserver' | 'did' | 'kds' | 'callbell' | 'etc'
  ): Promise<{ deletedCount: number }> => {
    const res = await fetch(`${API_URL}/api/eqids/store/${encodeURIComponent(storeRef)}/category/${encodeURIComponent(category)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || error.error || '카테고리 EQID 삭제에 실패했습니다.');
    }
    return res.json();
  },
  addResource: async (id: string, resource: Partial<EqidResource>): Promise<Eqid> => {
    const res = await fetch(`${API_URL}/api/eqids/${id}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || '리소스 추가에 실패했습니다.');
    }
    return res.json();
  },
  updateResource: async (id: string, resourceIndex: number, data: Partial<EqidResource>): Promise<Eqid> => {
    const res = await fetch(`${API_URL}/api/eqids/${id}/resources/${resourceIndex}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || '리소스 수정에 실패했습니다.');
    }
    return res.json();
  },
  deleteResource: async (id: string, resourceIndex: number): Promise<Eqid> => {
    const res = await fetch(`${API_URL}/api/eqids/${id}/resources/${resourceIndex}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('리소스 삭제에 실패했습니다.');
    }
    return res.json();
  },
};

// Upload API
export const uploadApi = {
  uploadSingle: async (file: File): Promise<{ type: string; url: string; filename: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/upload/single`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },
  uploadMultiple: async (files: File[]): Promise<{ files: Array<{ type: string; url: string; filename: string; size: number }> }> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const res = await fetch(`${API_URL}/api/upload/multiple`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },
};
