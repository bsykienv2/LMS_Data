
import { useContext } from 'react';
import { AuthContext } from '@/providers/AuthProvider';
import { AuthContextType } from '@/types';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};
