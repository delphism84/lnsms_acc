import { auth } from './auth';
import { getApiUrl } from './apiUrl';

function authHeaders(): Record<string, string> {
  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}/api/platform${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || (err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type PlatformStore = {
  _id: string;
  userid: string;
  storeId: string;
  name?: string;
  description?: string;
};

export const platformApi = {
  listStores: () => platformFetch<PlatformStore[]>('/stores'),

  /** unique userid list (구 agent 목록) */
  listAgents: async (): Promise<Array<{ agentId: string; userid: string }>> => {
    const stores = await platformFetch<PlatformStore[]>('/stores');
    const userids = [...new Set(stores.map((s) => s.userid).filter(Boolean))];
    return userids.sort().map((userid) => ({ agentId: userid, userid }));
  },

  listStoresByUser: (userid: string) =>
    platformFetch<PlatformStore[]>(`/stores/by-user/${encodeURIComponent(userid)}`),

  /** @deprecated use listStoresByUser */
  listStoresByAgent: (userid: string) =>
    platformFetch<PlatformStore[]>(`/stores/by-user/${encodeURIComponent(userid)}`),
  createStore: (body: { userid: string; storeId: string; name: string; password?: string } & Record<string, unknown>) =>
    platformFetch<PlatformStore>('/stores', { method: 'POST', body: JSON.stringify(body) }),
  getStore: (mongoId: string) => platformFetch<PlatformStore>(`/stores/${encodeURIComponent(mongoId)}`),
  updateStore: (mongoId: string, body: Partial<PlatformStore> & Record<string, unknown>) =>
    platformFetch<PlatformStore>(`/stores/${encodeURIComponent(mongoId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteStore: (mongoId: string) =>
    platformFetch<{ message: string }>(`/stores/${encodeURIComponent(mongoId)}`, { method: 'DELETE' }),
};
