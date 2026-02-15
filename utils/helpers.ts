import { Role } from '../types';

export const getRoleDisplayName = (role: Role): string => {
  switch (role) {
    case Role.ADMIN:
      return 'Quản trị viên';
    case Role.STUDENT:
      return 'Học sinh';
    default:
      return 'Khách';
  }
};

export const formatDate = (date: Date | string): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

// Chuyển đổi format dd/mm/yyyy (Excel/User input) sang yyyy-mm-dd (HTML Input/Storage)
export const parseDateToISO = (dateStr: string): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  
  // Nếu đã là format ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Xử lý dd/mm/yyyy hoặc dd-mm-yyyy
  if (str.includes('/') || str.includes('-')) {
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      // Kiểm tra sơ bộ xem phần đầu có phải năm không (ví dụ 2024/05/20)
      if (parts[0].length === 4) {
         return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
      }
      // Mặc định hiểu là dd/mm/yyyy
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return '';
};

export const generateUsername = (name: string): string => {
  if (!name) return '';
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};
