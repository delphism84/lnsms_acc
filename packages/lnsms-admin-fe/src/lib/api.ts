import type { AdminAuthResponse, AdminUser } from './types';

export type { Store, Category, Menu, MenuResource, Eqid, EqidResource, AdminUser, AdminAuthResponse } from './types';

import { getApiUrl } from './apiUrl';

export { getApiUrl } from './apiUrl';
export const API_URL = getApiUrl();

export const adminAuthApi = {
  login: async (username: string, password: string): Promise<AdminAuthResponse> => {
    const res = await fetch(`${getApiUrl()}/api/admin/auth/login`, {
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
    const res = await fetch(`${getApiUrl()}/api/admin/auth/verify`, {
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
