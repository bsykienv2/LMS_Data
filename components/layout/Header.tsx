import React from 'react';
import { LogOut, Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getRoleDisplayName } from '../../utils/helpers';
import { Button } from '../ui/Button';

interface HeaderProps {
  onMenuClick?: () => void;
  isSidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, isSidebarOpen = true }) => {
  const { user, logout } = useAuth();

  return (
    <header className={`h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 fixed top-0 right-0 z-20 transition-all duration-300 ${isSidebarOpen ? 'left-0 lg:left-64' : 'left-0'}`}>
      <div className="flex items-center gap-4">
        {/* Show Menu button on Mobile OR if Sidebar is closed on Desktop */}
        <button 
          onClick={onMenuClick}
          className={`p-2 hover:bg-gray-100 rounded-md text-gray-600 ${isSidebarOpen ? 'lg:hidden' : ''}`}
          title="Mở menu"
        >
          <Menu size={20} />
        </button>
        
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user && getRoleDisplayName(user.role)}</p>
          </div>
          {user?.avatar && (
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-8 h-8 rounded-full bg-gray-200 ring-2 ring-white"
            />
          )}
          <Button 
            variant="ghost" 
            onClick={logout}
            className="!p-2 text-gray-500 hover:text-red-600"
            title="Đăng xuất"
          >
            <LogOut size={20} />
          </Button>
        </div>
      </div>
    </header>
  );
};