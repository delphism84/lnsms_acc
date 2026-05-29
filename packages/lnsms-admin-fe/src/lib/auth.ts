'use client';

import { adminAuthApi, AdminUser } from './api';

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

export const auth = {
  // 로그인
  login: async (username: string, password: string): Promise<AdminUser> => {
    const response = await adminAuthApi.login(username, password);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }
    return response.user;
  },

  // 로그아웃
  logout: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  // 현재 사용자 정보 가져오기
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

  // 토큰 가져오기
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  // 로그인 상태 확인
  isAuthenticated: (): boolean => {
    return auth.getToken() !== null && auth.getCurrentUser() !== null;
  },

  // 토큰 검증
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

