import type { AdminAuthResponse, AdminUser } from './types';

export type { Store, Category, Menu, MenuResource, Eqid, EqidResource, AdminUser, AdminAuthResponse } from './types';

export const API_URL = (() => {
  const explicit = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      if (u.protocol === 'https:' && u.port === '40000') {
        u.port = '';
        return u.toString().replace(/\/$/, '');
      }
    } catch {
      // ignore
    }
    return explicit.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') return `${protocol}//${hostname}`;
    return `${protocol}//${hostname}:40000`;
  }
  return '';
})();

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
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error('토큰 검증에 실패했습니다.');
    return res.json();
  },
};
