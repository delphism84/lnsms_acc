const API_URL = (() => {
  const explicit = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') return `${protocol}//${hostname}`;
    return `${protocol}//${hostname}:40000`;
  }
  return '';
})();

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/platform${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || (err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type PlatformStore = {
  _id: string;
  agentId?: string;
  agentid?: string;
  storeId?: string;
  userid?: string;
  name?: string;
};

export type SyncBundle = {
  version: number;
  agentId: string;
  storeId: string;
  storeRef: string;
  exportedAt: string;
  store?: unknown;
  collections: Record<string, unknown[]>;
  files: unknown[];
};

export const platformApi = {
  listAgents: () => platformFetch<Array<{ agentId: string; agentid?: string }>>('/agents'),
  listStores: () => platformFetch<PlatformStore[]>('/stores'),
  listStoresByAgent: (agentId: string) => platformFetch<PlatformStore[]>(`/stores/by-agent/${encodeURIComponent(agentId)}`),
  createStore: (body: { agentId: string; storeId: string; name: string; description?: string } & Record<string, unknown>) =>
    platformFetch<PlatformStore>('/stores', {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        agentid: body.agentId,
        userid: body.storeId,
      }),
    }),
  getStore: (mongoId: string) => platformFetch<PlatformStore>(`/stores/${encodeURIComponent(mongoId)}`),
  updateStore: (mongoId: string, body: Partial<PlatformStore> & Record<string, unknown>) =>
    platformFetch<PlatformStore>(`/stores/${encodeURIComponent(mongoId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteStore: (mongoId: string) =>
    platformFetch<{ message: string }>(`/stores/${encodeURIComponent(mongoId)}`, { method: 'DELETE' }),
  exportBundle: (agentId: string, storeId: string) =>
    platformFetch<SyncBundle>('/sync/export', {
      method: 'POST',
      body: JSON.stringify({ agentId, storeId }),
    }),
  importBundle: (agentId: string, storeId: string, bundle: SyncBundle, mode: 'replace' | 'merge' = 'replace') =>
    platformFetch<{ success: boolean }>('/sync/import', {
      method: 'POST',
      body: JSON.stringify({ agentId, storeId, bundle, mode }),
    }),
};
