
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowRight, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth';
import { Role } from '../types';
import { Button } from '../components/ui/Button';

export const Login: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      const target = user.role === Role.ADMIN ? '/admin' : '/app';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authService.login(username, password);
      
      if (result.success && result.user) {
        login(result.user);
        // Navigation handled by useEffect
      } else {
        setError(result.error || 'Đăng nhập thất bại');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Có lỗi xảy ra, vui lòng thử lại.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600 text-white mb-6 shadow-blue-200 shadow-xl transform rotate-3">
            <GraduationCap size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LMS Việt Nam</h1>
          <p className="text-gray-500">Đăng nhập để tiếp tục</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="VD: hs, admin..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="password"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-start gap-2">
                   <span className="mt-0.5">⚠️</span> {error}
                </div>
              )}

              <Button 
                type="submit" 
                fullWidth 
                size="lg" 
                className="mt-2"
                disabled={isLoading}
              >
                {isLoading ? 'Đang xử lý...' : 'Đăng nhập'} <ArrowRight size={20} className="ml-2" />
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center text-sm text-gray-500">
              <p>Tài khoản dùng thử:</p>
              <div className="flex justify-center gap-4 mt-2 font-mono text-xs">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Admin: admin / 1</span>
                <span className="bg-green-50 text-green-700 px-2 py-1 rounded">Học sinh: hs / 1</span>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-center text-sm text-gray-400 mt-8">
          &copy; 2024 LMS Việt Nam. All rights reserved.
        </p>
      </div>
    </div>
  );
};
