import { REMOTE_API_URL } from './storeScopePaths';

const ACCESS_KEY = 'remote_host_access_token';
const REFRESH_KEY = 'remote_host_refresh_token';
const REMOTE_STORE_KEY = 'remote_host_store_key';

export type RemoteHostSession = {
  userid: string;
  storeId: string;
};

function saveTokens(accessToken: string, refreshToken: string, userid: string, storeId: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(REMOTE_STORE_KEY, `${userid}.${storeId}`);
}

export const remoteHostAuth = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },

  getSession(): RemoteHostSession | null {
    if (typeof window === 'undefined') return null;
    const key = localStorage.getItem(REMOTE_STORE_KEY);
    if (!key) return null;
    const [userid, storeId] = key.split('.');
    if (!userid || !storeId) return null;
    return { userid, storeId };
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  authHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async login(userid: string, storeId: string, password: string): Promise<RemoteHostSession> {
    const res = await fetch(`${REMOTE_API_URL}/api/host/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid, storeId, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '원격 로그인 실패');
    }
    const data = await res.json();
    saveTokens(data.accessToken || data.token, data.refreshToken, userid, storeId);
    return { userid, storeId };
  },

  logout() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(REMOTE_STORE_KEY);
  },
};

export async function checkRemoteOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${REMOTE_API_URL}/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function isOnlineMode(): Promise<boolean> {
  if (!remoteHostAuth.isAuthenticated()) return false;
  return checkRemoteOnline();
}
