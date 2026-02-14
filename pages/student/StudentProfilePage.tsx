import React, { useEffect, useState } from 'react';
import { User, Mail, GraduationCap, MapPin, Camera, CheckCircle, XCircle, TrendingUp, BookOpen, Clock, Zap, Star, Award, Crown, Lock } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/db';
import { Submission, User as UserType } from '../../types';
import { formatDate } from '../../utils/helpers';

// Badge Configuration
const BADGES = [
  {
    id: 'starter',
    name: 'Khởi đầu',
    description: 'Hoàn thành bài thi đầu tiên',
    icon: Star,
    color: 'bg-blue-100 text-blue-600',
    check: (subs: Submission[]) => subs.length >= 1
  },
  {
    id: 'hardworking',
    name: 'Chăm chỉ',
    description: 'Hoàn thành 5 bài thi',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-600',
    check: (subs: Submission[]) => subs.length >= 5
  },
  {
    id: 'excellent',
    name: 'Xuất sắc',
    description: 'Đạt điểm trên 9.0',
    icon: Award,
    color: 'bg-purple-100 text-purple-600',
    check: (subs: Submission[]) => subs.some(s => s.score >= 9.0)
  },
  {
    id: 'perfectionist',
    name: 'Tuyệt đối',
    description: 'Đạt điểm 10 trọn vẹn',
    icon: Crown,
    color: 'bg-red-100 text-red-600',
    check: (subs: Submission[]) => subs.some(s => s.score === 10)
  }
];

export const StudentProfilePage: React.FC = () => {
  const { user: contextUser } = useAuth();
  const [user, setUser] = useState<UserType | null>(contextUser);
  const [className, setClassName] = useState('Chưa cập nhật');
  const [stats, setStats] = useState({
    totalExams: 0,
    avgScore: '0.0',
    passed: 0,
    failed: 0,
    studyTime: 0 // minutes (mock or calculated)
  });
  const [recentHistory, setRecentHistory] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    if (contextUser) {
      // 1. Fetch fresh user data from DB to ensure avatar is up to date
      const freshUser = db.users.getById(contextUser.id);
      const currentUser = freshUser || contextUser;
      setUser(currentUser);

      // 2. Get Class Name
      if (currentUser.classId) {
        const cls = db.classes.getById(currentUser.classId);
        if (cls) setClassName(cls.name);
      }

      // 3. Calculate Stats
      const submissions = db.submissions.getAll();
      const mySubmissions = submissions.filter(s => s.studentId === currentUser.id);
      setAllSubmissions(mySubmissions);
      
      const total = mySubmissions.length;
      const passed = mySubmissions.filter(s => s.passed).length;
      const failed = total - passed;
      const avg = total > 0 
        ? (mySubmissions.reduce((a, b) => a + b.score, 0) / total).toFixed(1) 
        : '0.0';
      
      // Calculate approximate study time (End - Start)
      let timeMinutes = 0;
      mySubmissions.forEach(s => {
        if (s.endTime && s.startTime) {
           const diff = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
           timeMinutes += diff / 1000 / 60;
        }
      });

      setStats({
        totalExams: total,
        avgScore: avg,
        passed,
        failed,
        studyTime: Math.round(timeMinutes)
      });

      // 4. Recent History
      setRecentHistory(mySubmissions.sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime()).slice(0, 5));
    }
  }, [contextUser]);

  const getExamTitle = (assignId: string) => {
    const assign = db.assignments.getById(assignId);
    if (!assign) return 'N/A';
    const exam = db.exams.getById(assign.examId);
    return exam?.title || 'N/A';
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Cover Banner */}
      <div className="h-48 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden shadow-lg">
         <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
         <div className="absolute bottom-4 right-4 text-white/80 text-sm font-medium">
            Học tập là hành trình không ngừng nghỉ
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 -mt-16 relative z-10">
        
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1">
          <Card className="text-center h-full border-t-4 border-t-blue-500">
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-100 mx-auto">
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                    <User size={48} />
                  </div>
                )}
              </div>
              {/* Note: Editing functionality is typically for Admin or separate settings page, keeping disabled here for now to avoid complexity unless requested */}
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
            <p className="text-gray-500 font-medium mb-6">Học sinh lớp {className}</p>

            <div className="space-y-4 text-left border-t border-gray-100 pt-6">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Lớp học</p>
                  <p className="text-sm font-medium">{className}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                 <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                   <MapPin size={18} />
                 </div>
                 <div>
                   <p className="text-xs text-gray-400">Trường</p>
                   <p className="text-sm font-medium">THCS Chất lượng cao</p>
                 </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Stats & History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 border border-gray-100 hover:shadow-md transition-shadow text-center">
               <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
                 <BookOpen size={20} />
               </div>
               <p className="text-2xl font-bold text-gray-900">{stats.totalExams}</p>
               <p className="text-xs text-gray-500">Đề đã làm</p>
            </Card>

            <Card className="p-4 border border-gray-100 hover:shadow-md transition-shadow text-center">
               <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto mb-2">
                 <TrendingUp size={20} />
               </div>
               <p className="text-2xl font-bold text-gray-900">{stats.avgScore}</p>
               <p className="text-xs text-gray-500">Điểm trung bình</p>
            </Card>

            <Card className="p-4 border border-gray-100 hover:shadow-md transition-shadow text-center">
               <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-2">
                 <CheckCircle size={20} />
               </div>
               <p className="text-2xl font-bold text-gray-900">{stats.passed}</p>
               <p className="text-xs text-gray-500">Lần đạt</p>
            </Card>

            <Card className="p-4 border border-gray-100 hover:shadow-md transition-shadow text-center">
               <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2">
                 <Clock size={20} />
               </div>
               <p className="text-2xl font-bold text-gray-900">{stats.studyTime}</p>
               <p className="text-xs text-gray-500">Phút làm bài</p>
            </Card>
          </div>

          {/* Gamification Badges */}
          <Card>
            <div className="flex items-center gap-2 mb-4 border-b pb-3">
              <Award className="text-orange-500" size={24} />
              <h3 className="font-bold text-gray-900">Bộ sưu tập huy hiệu</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {BADGES.map((badge) => {
                const isEarned = badge.check(allSubmissions);
                const Icon = badge.icon;
                
                return (
                  <div 
                    key={badge.id}
                    className={`relative p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                      isEarned 
                        ? 'bg-white border-gray-200 shadow-sm' 
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      isEarned ? badge.color : 'bg-gray-200 text-gray-400'
                    }`}>
                      <Icon size={24} />
                    </div>
                    <h4 className={`font-bold text-sm ${isEarned ? 'text-gray-900' : 'text-gray-400'}`}>
                      {badge.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {badge.description}
                    </p>
                    
                    {!isEarned && (
                      <div className="absolute top-2 right-2 text-gray-300">
                        <Lock size={14} />
                      </div>
                    )}
                    
                    {isEarned && (
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        Đã nhận
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Achievement / History Section */}
          <Card title="Lịch sử làm bài gần đây">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-500 font-medium">
                   <tr>
                     <th className="px-4 py-3 rounded-l-lg">Bài thi</th>
                     <th className="px-4 py-3">Ngày làm</th>
                     <th className="px-4 py-3">Trạng thái</th>
                     <th className="px-4 py-3 text-right rounded-r-lg">Điểm số</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {recentHistory.length === 0 ? (
                     <tr><td colSpan={4} className="py-8 text-center text-gray-400">Chưa có dữ liệu làm bài</td></tr>
                   ) : (
                     recentHistory.map((sub) => (
                       <tr key={sub.id} className="hover:bg-gray-50">
                         <td className="px-4 py-3 font-medium text-gray-900">{getExamTitle(sub.assignmentId)}</td>
                         <td className="px-4 py-3 text-gray-500">
                           {sub.endTime ? formatDate(new Date(sub.endTime)) : '-'}
                         </td>
                         <td className="px-4 py-3">
                           {sub.passed ? (
                             <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                               <CheckCircle size={12} /> Đạt
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-medium">
                               <XCircle size={12} /> Chưa đạt
                             </span>
                           )}
                         </td>
                         <td className="px-4 py-3 text-right font-bold text-blue-600">
                           {sub.score}
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};