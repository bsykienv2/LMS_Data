
import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { MainLayout } from './layouts/MainLayout';
import { Role } from './types';
import { useAuth } from './hooks/useAuth';
import { Skeleton } from './components/ui/Skeleton';

// --- Lazy Load Pages ---
// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const InitializePage = lazy(() => import('./pages/admin/InitializePage').then(module => ({ default: module.InitializePage })));
const QuestionBankPage = lazy(() => import('./pages/admin/QuestionBankPage').then(module => ({ default: module.QuestionBankPage })));
const ExamManagerPage = lazy(() => import('./pages/admin/ExamManagerPage').then(module => ({ default: module.ExamManagerPage })));
const AssignmentPage = lazy(() => import('./pages/admin/AssignmentPage').then(module => ({ default: module.AssignmentPage })));
const ResultsPage = lazy(() => import('./pages/admin/ResultsPage').then(module => ({ default: module.ResultsPage })));
const SystemLogsPage = lazy(() => import('./pages/admin/SystemLogsPage').then(module => ({ default: module.SystemLogsPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then(module => ({ default: module.SettingsPage })));
const StudentManagerPage = lazy(() => import('./pages/admin/StudentManagerPage').then(module => ({ default: module.StudentManagerPage })));
const UserManagerPage = lazy(() => import('./pages/admin/UserManagerPage').then(module => ({ default: module.UserManagerPage })));

// Student Pages
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard').then(module => ({ default: module.StudentDashboard })));
const StudentProfilePage = lazy(() => import('./pages/student/StudentProfilePage').then(module => ({ default: module.StudentProfilePage })));
const ExamEntryPage = lazy(() => import('./pages/student/ExamEntryPage').then(module => ({ default: module.ExamEntryPage })));
const ExamTakingPage = lazy(() => import('./pages/student/ExamTakingPage').then(module => ({ default: module.ExamTakingPage })));
const ExamResultPage = lazy(() => import('./pages/student/ExamResultPage').then(module => ({ default: module.ExamResultPage })));

// Loading Fallback Component
const PageLoader = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-1/3" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
    <Skeleton className="h-64" />
  </div>
);

// Create a Wrapper for Exam Routes to ensure Auth check without MainLayout UI
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: Role[] }> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  
  return <Suspense fallback={<div className="h-screen flex items-center justify-center">Đang tải tài nguyên...</div>}>{children}</Suspense>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Suspense fallback={<div className="h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<MainLayout allowedRoles={[Role.ADMIN]} />}>
            <Route index element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
            <Route path="students" element={<Suspense fallback={<PageLoader />}><StudentManagerPage /></Suspense>} />
            <Route path="init" element={<Suspense fallback={<PageLoader />}><InitializePage /></Suspense>} />
            <Route path="questions" element={<Suspense fallback={<PageLoader />}><QuestionBankPage /></Suspense>} />
            <Route path="exams" element={<Suspense fallback={<PageLoader />}><ExamManagerPage /></Suspense>} />
            <Route path="assignments" element={<Suspense fallback={<PageLoader />}><AssignmentPage /></Suspense>} />
            <Route path="logs" element={<Suspense fallback={<PageLoader />}><SystemLogsPage /></Suspense>} />
            <Route path="courses" element={<div className="p-4">Quản lý khóa học (Đang phát triển)</div>} />
            <Route path="users" element={<Suspense fallback={<PageLoader />}><UserManagerPage /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<PageLoader />}><ResultsPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
          </Route>

          {/* Student Routes */}
          <Route path="/app" element={<MainLayout allowedRoles={[Role.STUDENT]} />}>
            <Route index element={<Suspense fallback={<PageLoader />}><StudentDashboard /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<PageLoader />}><StudentProfilePage /></Suspense>} />
            <Route path="my-courses" element={<div className="p-4">Khóa học của tôi (Đang phát triển)</div>} />
            <Route path="schedule" element={<div className="p-4">Lịch học (Đang phát triển)</div>} />
            <Route path="grades" element={<div className="p-4">Bảng điểm (Đang phát triển)</div>} />
          </Route>

          {/* Exam Routes - Full Screen Focus Mode */}
          <Route path="/exam" element={
            <ProtectedRoute allowedRoles={[Role.STUDENT]}>
              <ExamEntryPage />
            </ProtectedRoute>
          } />
          <Route path="/exam/:assignmentId/take" element={
            <ProtectedRoute allowedRoles={[Role.STUDENT]}>
              <ExamTakingPage />
            </ProtectedRoute>
          } />
          <Route path="/exam/:submissionId/result" element={
            <ProtectedRoute allowedRoles={[Role.STUDENT]}>
              <ExamResultPage />
            </ProtectedRoute>
          } />

          {/* Default Redirect */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<div className="flex items-center justify-center h-screen">404 - Không tìm thấy trang</div>} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === Role.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/app" replace />;
};

export default App;
