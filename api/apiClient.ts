
import { CONFIG } from '@/config/env';

const STORAGE_KEY = 'lms_user';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  error?: any;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private getToken(): string | null {
    try {
      const userStr = localStorage.getItem(STORAGE_KEY);
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return user.token || null;
    } catch (e) {
      return null;
    }
  }

  private handleAuthError() {
    window.dispatchEvent(new Event('lms:auth:expired'));
  }

  private async request<T>(
    method: 'GET' | 'POST',
    payload: Record<string, any> = {}
  ): Promise<ApiResponse<T>> {
    // 1. CHECK CONFIGURATION
    if (!this.baseUrl || this.baseUrl.includes('DÁN_URL') || !this.baseUrl.startsWith('http')) {
      return {
        success: false,
        message: 'Lỗi cấu hình: Bạn chưa dán URL Web App vào file .env',
        data: null as any
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Sử dụng text/plain để tránh CORS preflight phức tạp của Google Script
    const headers: HeadersInit = {
      'Content-Type': 'text/plain;charset=utf-8', 
    };

    // Chuẩn bị payload: Gộp data + token + secret
    // Google Script nhận POST body dạng text, ta tự parse bên kia
    const finalPayload = {
      ...payload,
      _sec: {
        token: this.getToken(),
        secret: CONFIG.API_SECRET // Gửi secret đi
      }
    };

    let url = this.baseUrl;
    const options: RequestInit = {
      method,
      signal: controller.signal,
      headers: headers,
    };

    if (method === 'GET') {
      // GET trong GAS: Query params
      const params = new URLSearchParams();
      
      // Flatten payload cho GET query (chỉ hỗ trợ 1 cấp object đơn giản)
      Object.keys(payload).forEach(key => {
        const val = payload[key];
        if (val !== undefined && val !== null) {
          params.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
        }
      });
      
      // Append security params riêng lẻ cho GET
      params.append('token', this.getToken() || '');
      params.append('secret', CONFIG.API_SECRET);

      url = `${url}?${params.toString()}`;
    } else {
      // POST: Stringify toàn bộ body
      options.body = JSON.stringify(finalPayload);
    }

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      // Xử lý trường hợp Google Script trả về HTML (Lỗi Server/Permission) thay vì JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") === -1) {
         // Nếu không phải JSON, thường là lỗi HTML từ Google (404, 403, hoặc script crash)
         const text = await response.text();
         console.error("API returned non-JSON response:", text.substring(0, 500));
         return {
            success: false,
            message: 'Lỗi kết nối Backend (Phản hồi không đúng định dạng). Vui lòng kiểm tra quyền truy cập Web App (Who has access: Anyone).',
            data: null as any
         };
      }

      const resJson: ApiResponse<T> = await response.json();

      if (!resJson.success) {
        const msg = resJson.message?.toLowerCase() || '';
        if (msg.includes('unauthorized') || msg.includes('token') || msg.includes('phiên đăng nhập')) {
          this.handleAuthError();
        }
      }

      return resJson;

    } catch (error: any) {
      clearTimeout(timeoutId);
      const isTimeout = error.name === 'AbortError';
      const errorMessage = isTimeout ? 'Kết nối quá hạn (Timeout). Vui lòng kiểm tra mạng.' : (error.message || 'Lỗi kết nối máy chủ');
      console.error('[ApiClient Error]', error);

      return {
        success: false,
        message: errorMessage,
        data: null as any,
        error: error
      };
    }
  }

  // Wrapper methods
  async get<T>(resource: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    return this.request<T>('GET', { resource, ...params });
  }

  async getById<T>(resource: string, id: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', { resource, id });
  }

  async post<T>(resource: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', { resource, data }); // Default action is CREATE handled by backend logic if not specified
  }

  async put<T>(resource: string, id: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', { action: 'update', resource, id, data }); // Apps Script POST tunnel
  }

  async delete<T>(resource: string, id: string): Promise<ApiResponse<T>> {
    return this.request<T>('POST', { action: 'delete', resource, id });
  }

  async invoke<T>(action: string, payload: any = {}): Promise<ApiResponse<T>> {
    return this.request<T>('POST', { action, ...payload });
  }
}

export const apiClient = new ApiClient(CONFIG.API_URL);
