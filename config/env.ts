
/**
 * Quản lý tập trung các biến môi trường.
 */

const getEnv = (key: string, defaultValue: string = ''): string => {
  try {
    // Kiểm tra an toàn xem env có tồn tại không trước khi truy cập
    const env = (import.meta as any).env;
    if (!env) return defaultValue;
    
    const value = env[key];
    if (value === undefined || value === null) {
      return defaultValue;
    }
    return String(value);
  } catch (e) {
    // Tránh crash nếu import.meta lỗi
    return defaultValue;
  }
};

export const CONFIG = {
  // Đường dẫn đến Google Apps Script Web App
  API_URL: getEnv('VITE_API_URL'),
  
  // Secret Key để gửi kèm mỗi request (Tăng bảo mật)
  API_SECRET: getEnv('VITE_API_SECRET', 'default-secret-key'),
  
  APP_NAME: getEnv('VITE_APP_NAME', 'LMS App'),
  APP_VERSION: getEnv('VITE_APP_VERSION', '1.0.0'),
  IS_DEV: (import.meta as any).env?.DEV || false,
  IS_PROD: (import.meta as any).env?.PROD || false,
};

if (!CONFIG.API_URL) {
  console.warn("⚠️ Cảnh báo: Thiếu VITE_API_URL. App sẽ không kết nối được Server.");
}
