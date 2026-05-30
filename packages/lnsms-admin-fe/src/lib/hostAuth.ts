import { LOCAL_STORE_ID, LOCAL_USERID } from './storeScopePaths';

const ACCESS_KEY = 'host_access_token';
const REFRESH_KEY = 'host_refresh_token';
const STORE_KEY = 'host_store_key';

export type HostStore = {
  _id?: string;
  userid: string;
  storeId: string;
  name?: string;
};

function storeKey(userid: string, storeId: string) {
  return `${userid}.${storeId}`;
}

function saveTokens(accessToken: string, refreshToken: string, userid: string, storeId: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(STORE_KEY, storeKey(userid, storeId));
}

export const hostAuth = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  },

  getStoreKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORE_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  authHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async login(userid: string, storeId: string, password: string, apiBase = ''): Promise<HostStore> {
    const res = await fetch(`${apiBase}/api/host/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid, storeId, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '로그인 실패');
    }
    const data = await res.json();
    saveTokens(data.accessToken || data.token, data.refreshToken, userid, storeId);
    return data.store as HostStore;
  },

  async refresh(apiBase = ''): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${apiBase}/api/host/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const [userid, storeId] = (this.getStoreKey() || '.').split('.');
      saveTokens(data.accessToken || data.token, data.refreshToken, userid, storeId);
      return true;
    } catch {
      return false;
    }
  },

  async autoLoginLocal(): Promise<HostStore> {
    const password = (process.env.NEXT_PUBLIC_LOCAL_GUEST_PASSWORD || 'guest').trim();
    if (this.isAuthenticated()) {
      const ok = await this.verify('');
      if (ok) {
        const [userid, storeId] = (this.getStoreKey() || `${LOCAL_USERID}.${LOCAL_STORE_ID}`).split('.');
        return { userid, storeId };
      }
    }
    return this.login(LOCAL_USERID, LOCAL_STORE_ID, password);
  },

  async verify(apiBase = ''): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) return false;
    try {
      const res = await fetch(`${apiBase}/api/host/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return true;
      if (res.status === 401) return this.refresh(apiBase);
      return false;
    } catch {
      return false;
    }
  },

  logout() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(STORE_KEY);
  },
};
