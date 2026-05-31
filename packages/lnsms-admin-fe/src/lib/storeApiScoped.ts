import { storeApiBase } from './storeScopePaths';
import { storeAuthHeaders } from './storeAccess';
import type { Category, Eqid, EqidResource, Menu, MenuResource, Store } from './types';

export type StoreContext = {
  userid: string;
  storeId: string;
  storeRef: string;
  name?: string;
  description?: string;
  store: Store;
};

function authHeaders(userid: string, storeId: string): Record<string, string> {
  return storeAuthHeaders(userid, storeId);
}

function base(userid: string, storeId: string) {
  const root = storeApiBase(userid, storeId);

  return {
    root,
    async json<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await fetch(`${root}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(userid, storeId),
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string; message?: string }).error ||
            (err as { message?: string }).message ||
            res.statusText
        );
      }
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    },
    async upload<T>(path: string, formData: FormData): Promise<T> {
      const res = await fetch(`${root}${path}`, {
        method: 'POST',
        headers: authHeaders(userid, storeId),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      return res.json() as Promise<T>;
    },
  };
}

export function createStoreApi(userid: string, storeId: string) {
  const api = base(userid, storeId);

  return {
    getContext: () => api.json<StoreContext>('/context'),
    getStore: async (): Promise<Store> => {
      const ctx = await api.json<StoreContext>('/context');
      return ctx.store;
    },
    updateStore: (body: Partial<Store>) =>
      api.json<Store>('/context', { method: 'PUT', body: JSON.stringify(body) }),
    updatePassword: (password: string) =>
      fetch(`/api/host/${encodeURIComponent(userid)}/${encodeURIComponent(storeId)}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(userid, storeId) },
        body: JSON.stringify({ password }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message || '비밀번호 변경 실패');
        }
        return res.json() as Promise<{ message: string }>;
      }),

    listCategories: () => api.json<Category[]>('/categories'),
    getCategory: (id: string) => api.json<Category>(`/categories/${id}`),
    createCategory: (body: Partial<Category>) =>
      api.json<Category>('/categories', { method: 'POST', body: JSON.stringify(body) }),
    updateCategory: (id: string, body: Partial<Category>) =>
      api.json<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteCategory: (id: string) => api.json<unknown>(`/categories/${id}`, { method: 'DELETE' }),

    listMenus: () => api.json<Menu[]>('/menus'),
    listMenusByCategory: (categoryId: string) => api.json<Menu[]>(`/menus/category/${categoryId}`),
    getMenu: (id: string) => api.json<Menu>(`/menus/${id}`),
    createMenu: (body: Partial<Menu>) => api.json<Menu>('/menus', { method: 'POST', body: JSON.stringify(body) }),
    updateMenu: (id: string, body: Partial<Menu>) =>
      api.json<Menu>(`/menus/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteMenu: (id: string) => api.json<unknown>(`/menus/${id}`, { method: 'DELETE' }),
    addMenuResource: (id: string, resource: Partial<MenuResource>) =>
      api.json<Menu>(`/menus/${id}/resources`, { method: 'POST', body: JSON.stringify(resource) }),
    deleteMenuResource: (id: string, resourceIndex: number) =>
      api.json<Menu>(`/menus/${id}/resources/${resourceIndex}`, { method: 'DELETE' }),

    listEqids: () => api.json<Eqid[]>('/eqids'),
    createEqid: (body: Partial<Eqid>) => api.json<Eqid>('/eqids', { method: 'POST', body: JSON.stringify(body) }),
    updateEqid: (id: string, body: Partial<Eqid>) =>
      api.json<Eqid>(`/eqids/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteEqid: (id: string) => api.json<unknown>(`/eqids/${id}`, { method: 'DELETE' }),
    deleteEqidsByCategory: (category: string) =>
      api.json<{ deletedCount: number }>(`/eqids/category/${encodeURIComponent(category)}`, { method: 'DELETE' }),
    addEqidResource: (id: string, resource: Partial<EqidResource>) =>
      api.json<Eqid>(`/eqids/${id}/resources`, { method: 'POST', body: JSON.stringify(resource) }),
    updateEqidResource: (id: string, resourceIndex: number, body: Partial<EqidResource>) =>
      api.json<Eqid>(`/eqids/${id}/resources/${resourceIndex}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteEqidResource: (id: string, resourceIndex: number) =>
      api.json<Eqid>(`/eqids/${id}/resources/${resourceIndex}`, { method: 'DELETE' }),
  };
}

/** @deprecated alias — agentId param is userid */
export function createStoreApiLegacy(agentId: string, storeId: string) {
  return createStoreApi(agentId, storeId);
}

export type StoreApiScoped = ReturnType<typeof createStoreApi>;
