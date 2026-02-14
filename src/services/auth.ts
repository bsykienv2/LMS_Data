
import { User } from '@/types';
import { api } from './api';

const STORAGE_KEY = 'lms_user';

export const authService = {
  // Lấy user từ localStorage (client cache)
  getUser: (): User | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      return null;
    }
  },

  // Đăng nhập qua API Google Sheets
  login: async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const response = await api.login(username, password);
      
      if (response.success && response.data && response.data.user) {
        const user = response.data.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        return { success: true, user };
      } else {
        return { success: false, error: response.message || 'Đăng nhập thất bại' };
      }
    } catch (e) {
      return { success: false, error: 'Lỗi kết nối đến máy chủ' };
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(STORAGE_KEY);
  }
};
