
import { apiClient } from '@/api/apiClient';

/**
 * Service Layer: Ánh xạ các nghiệp vụ gọi qua ApiClient chuẩn
 */
export const api = {
  // 1. Standard CRUD
  get: async (resource: string, id?: string) => {
    if (id) {
      return apiClient.getById(resource, id);
    }
    return apiClient.get(resource);
  },

  create: async (resource: string, data: any) => {
    return apiClient.post(resource, data);
  },

  update: async (resource: string, id: string, data: any) => {
    return apiClient.put(resource, id, data);
  },

  delete: async (resource: string, id: string) => {
    return apiClient.delete(resource, id);
  },

  // 2. Auth
  login: async (username: string, password: string) => {
    // Login là action đặc biệt, gọi qua invoke
    // Sử dụng <any> để tránh lỗi TS infer ra {}
    return apiClient.invoke<any>('login', { 
      data: { username, password } 
    });
  },

  // 3. Custom Business Actions (Thống kê, Nộp bài...)
  customAction: async (actionName: string, data: any) => {
    return apiClient.invoke<any>(actionName, { data });
  }
};
