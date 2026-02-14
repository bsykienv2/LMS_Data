
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, Role, User } from '@/types';
import { authService } from '@/services/auth';

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(authService.getUser());

  const login = (newUser: User) => {
    setUser(newUser);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  // Listen for Token Expiration Event from ApiClient
  useEffect(() => {
    const handleAuthExpired = () => {
      console.warn('Session expired. Logging out...');
      logout();
      alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };

    window.addEventListener('lms:auth:expired', handleAuthExpired);

    return () => {
      window.removeEventListener('lms:auth:expired', handleAuthExpired);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
