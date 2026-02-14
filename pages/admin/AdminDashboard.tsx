import React, { useState, useEffect } from 'react';
import { Users, FileCheck, Award, TrendingUp, Filter, Clock, CheckCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { db } from '../../services/db';
import { User, Submission, Grade, Class, Role } from '../../types';
import { formatDate } from '../../utils/helpers';

const StatCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: any; color: string }> = ({ 
  title, value, subValue, icon: Icon, color 
}) => (
  <Card className="relative overflow-hidden border-l-4" style={{ borderLeftColor: color.replace('bg-', '').replace('-100', '-500') }}>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${color} text-${color.split('-')[1]}-600`}>
        <Icon size={24} />
      </div>
    </div>
    {subValue && (
      <div className="mt-4 flex items-center text-sm text-gray-500">
        {subValue}
      </div>
    )}
  </Card>
);

export const AdminDashboard: React.FC = () => {
  // Data State
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [examsCount, setExamsCount] = useState(0);

  // Filter State
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  useEffect(() => {
    setGrades(db.grades.getAll());
    setClasses(db.classes.getAll());
    setUsers(db.users.getAll());
    setSubmissions(db.submissions.getAll());
    setExamsCount(db.exams.getAll().length);
  }, []);

  // --- Calculations ---

  // 1. Filter Students
  const filteredStudents = users.filter(u => {
    if (u.role !== Role.STUDENT) return false;
    if (selectedClassId && u.classId !== selectedClassId) return false;
    if (selectedGradeId) {
      const cls = classes.find(c => c.id === u.classId);
      if (cls?.gradeId !== selectedGradeId) return false;
    }
    return true;
  });

  // 2. Filter Submissions (based on filtered students)
  const filteredStudentIds = filteredStudents.map(u => u.id);
  const filteredSubmissions = submissions.filter(s => filteredStudentIds.includes(s.studentId));

  // 3. Stats
  const totalStudents = filteredStudents.length;
  const totalSubmissions = filteredSubmissions.length;
  
  const avgScore = totalSubmissions > 0
    ? (filteredSubmissions.reduce((acc, s) => acc + s.score, 0) / totalSubmissions).toFixed(1)
    : '0.0';

  const passRate = totalSubmissions > 0
    ? Math.round((filteredSubmissions.filter(s => s.passed).length / totalSubmissions) * 100)
    : 0;

  // 4. Leaderboard Calculation
  const leaderboard = filteredStudents.map(student => {
    const studentSubs = submissions.filter(s => s.studentId === student.id);
    const avg = studentSubs.length > 0 
      ? studentSubs.reduce((acc, s) => acc + s.score, 0) / studentSubs.length 
      : 0;
    return {
      ...student,
      avgScore: avg.toFixed(1),
      examsTaken: studentSubs.length
    };
  })
  .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore))
  .slice(0, 5); // Top 5

  // 5. Recent Activity
  const recentActivity = [...filteredSubmissions]
    .sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime())
    .slice(0, 5);

  const getStudentName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getExamName = (assignId: string) => {
    const assign = db.assignments.getById(assignId);
    if (!assign) return 'N/A';
    const exam = db.exams.getById(assign.examId);
    return exam?.title || 'N/A';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
        
        {/* Filters */}
        <div className="flex gap-2">
          <select 
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            value={selectedGradeId}
            onChange={(e) => setSelectedGradeId(e.target.value)}
          >
            <option value="">Tất cả Khối</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select 
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Tất cả Lớp</option>
            {classes
              .filter(c => !selectedGradeId || c.gradeId === selectedGradeId)
              .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Tổng học sinh" 
          value={totalStudents} 
          subValue="Trong phạm vi lọc"
          icon={Users} 
          color="bg-blue-100"
        />
        <StatCard 
          title="Số bài đã nộp" 
          value={totalSubmissions} 
          subValue={`Trên tổng số ${examsCount} đề thi gốc`}
          icon={FileCheck} 
          color="bg-purple-100"
        />
        <StatCard 
          title="Điểm trung bình" 
          value={avgScore} 
          subValue="Thang điểm 10"
          icon={TrendingUp} 
          color="bg-yellow-100"
        />
        <StatCard 
          title="Tỷ lệ đạt" 
          value={`${passRate}%`} 
          subValue="Điểm >= 5.0"
          icon={CheckCircle} 
          color="bg-green-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Submissions */}
        <div className="lg:col-span-2">
          <Card title="Hoạt động nộp bài gần đây">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-sm font-semibold text-white uppercase bg-[#17a2a1]">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Học sinh</th>
                    <th className="px-4 py-3">Bài thi</th>
                    <th className="px-4 py-3">Thời gian nộp</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentActivity.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-gray-500">Chưa có dữ liệu</td></tr>
                  ) : (
                    recentActivity.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-bold">
                            {getStudentName(sub.studentId).charAt(0)}
                          </div>
                          {getStudentName(sub.studentId)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{getExamName(sub.assignmentId)}</td>
                        <td className="px-4 py-3 text-gray-500 flex items-center gap-1">
                          <Clock size={12} />
                          {sub.endTime ? new Date(sub.endTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '-'} 
                          <span className="text-xs">({formatDate(new Date(sub.endTime!))})</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${sub.passed ? 'text-green-600' : 'text-red-500'}`}>
                            {sub.score}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <Button variant="ghost" size="sm" onClick={() => window.location.hash = '#/admin/reports'}>Xem tất cả báo cáo</Button>
            </div>
          </Card>
        </div>
        
        {/* Leaderboard */}
        <div>
          <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Award className="text-yellow-500" /> Bảng vàng thành tích
              </h3>
            </div>
            <div className="space-y-4">
              {leaderboard.length === 0 ? (
                <p className="text-center text-gray-500">Chưa có dữ liệu xếp hạng</p>
              ) : (
                leaderboard.map((student, index) => (
                  <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                    <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white ${
                      index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.examsTaken} bài thi</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">{student.avgScore}</p>
                      <p className="text-xs text-gray-400">TB</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};