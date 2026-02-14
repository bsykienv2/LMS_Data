import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';

interface MainLayoutProps {
  allowedRoles: Role[];
}

export const MainLayout: React.FC<MainLayoutProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 1. Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Check if user has permission to access this route
  if (user && !allowedRoles.includes(user.role)) {
    // Redirect to their appropriate dashboard if they try to access a restricted area
    const redirectPath = user.role === Role.ADMIN ? '/admin' : '/app';
    return <Navigate to={redirectPath} replace />;
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-[#EBF4F6] flex flex-col">
      {/* Sidebar is rendered but hidden via CSS based on state, or transform logic */}
      <div className={`fixed inset-y-0 left-0 z-30 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden'}`}>
        <Sidebar onToggle={toggleSidebar} isOpen={isSidebarOpen} />
      </div>
      
      {/* Header needs to know about sidebar to handle its own layout or menu button visibility */}
      <Header onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />

      {/* Main Content moves based on sidebar state */}
      <main className={`flex-1 pt-16 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <div className="p-4 sm:p-6 mx-auto max-w-7xl w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};