'use client';

import { adminAuthApi, AdminUser } from './api';

const TOKEN_KEY = 'admin_token';
const REFRESH_KEY = 'admin_refresh_token';
const USER_KEY = 'admin_user';

function saveSession(accessToken: string, refreshToken: string, user: AdminUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export const auth = {
  login: async (username: string, password: string): Promise<AdminUser> => {
    const response = await adminAuthApi.login(username, password);
    if (typeof window !== 'undefined') {
      saveSession(response.accessToken || response.token, response.refreshToken, response.user);
    }
    return response.user;
  },

  logout: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  getCurrentUser: (): AdminUser | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated: (): boolean => {
    return auth.getToken() !== null && auth.getCurrentUser() !== null;
  },

  verifyToken: async (): Promise<boolean> => {
    const token = auth.getToken();
    if (!token) return false;

    try {
      const result = await adminAuthApi.verify(token);
      if (result.valid && typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        return true;
      }
      return false;
    } catch {
      auth.logout();
      return false;
    }
  },
};
