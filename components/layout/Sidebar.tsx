
import React, { useState, useEffect, memo } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, Settings, GraduationCap, Calendar, FileText, Database, HelpCircle, FileCheck, Send, PlayCircle, User, History, UserCheck, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types';
import { db } from '../../services/db';

interface SidebarProps {
  onToggle: () => void;
  isOpen: boolean;
}

const SidebarComponent: React.FC<SidebarProps> = ({ onToggle, isOpen }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === Role.ADMIN;
  const [appName, setAppName] = useState('LMS Việt');

  useEffect(() => {
    // Initial Load
    setAppName(db.config.getAppName());

    // Listen for config changes
    const handleConfigChange = () => {
      setAppName(db.config.getAppName());
    };

    window.addEventListener('lms-config-changed', handleConfigChange);

    return () => {
      window.removeEventListener('lms-config-changed', handleConfigChange);
    };
  }, []);

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Tổng quan', color: 'text-blue-600' },
    { to: '/admin/students', icon: GraduationCap, label: 'Học sinh', color: 'text-green-600' }, 
    { to: '/admin/init', icon: Database, label: 'Khởi tạo dữ liệu', color: 'text-indigo-600' },
    { to: '/admin/questions', icon: HelpCircle, label: 'Ngân hàng câu hỏi', color: 'text-purple-600' },
    { to: '/admin/exams', icon: FileCheck, label: 'Quản lý đề thi', color: 'text-teal-600' },
    { to: '/admin/assignments', icon: Send, label: 'Giao đề thi', color: 'text-pink-600' },
    { to: '/admin/logs', icon: History, label: 'Nhật ký hoạt động', color: 'text-gray-700' },
    { to: '/admin/users', icon: UserCheck, label: 'Tài khoản người dùng', color: 'text-cyan-600' }, 
    { to: '/admin/reports', icon: FileText, label: 'Báo cáo', color: 'text-red-600' },
    { to: '/admin/settings', icon: Settings, label: 'Cài đặt', color: 'text-gray-600' },
  ];

  const studentLinks = [
    { to: '/app', icon: LayoutDashboard, label: 'Bảng điều khiển', color: 'text-blue-600' },
    { to: '/app/profile', icon: User, label: 'Hồ sơ cá nhân', color: 'text-indigo-600' },
    { to: '/exam', icon: PlayCircle, label: 'Vào thi ngay', color: 'text-red-600' },
    { to: '/app/my-courses', icon: GraduationCap, label: 'Khóa học của tôi', color: 'text-green-600' },
    { to: '/app/schedule', icon: Calendar, label: 'Lịch học', color: 'text-purple-600' },
    { to: '/app/grades', icon: FileText, label: 'Bảng điểm', color: 'text-yellow-600' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;
  
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col shadow-sm">
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-[#17a2a1]">
          <GraduationCap size={32} />
          <span className="text-xl font-bold tracking-tight text-gray-800 truncate max-w-[140px]">{appName}</span>
        </div>
        <button 
          onClick={onToggle} 
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors"
          title="Thu gọn menu"
        >
          <Menu size={24} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin' || link.to === '/app'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm font-medium border border-transparent ${
                isActive
                  ? 'bg-[#EBF4F6] text-[#17a2a1] border-gray-100 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <link.icon size={22} className={isActive ? 'text-[#17a2a1]' : link.color} />
                <span>{link.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50/50">
        <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase mb-1">Phiên bản</p>
          <p className="text-xs text-gray-700 font-mono">v1.2.0 (Stable)</p>
        </div>
      </div>
    </aside>
  );
};

export const Sidebar = memo(SidebarComponent);
