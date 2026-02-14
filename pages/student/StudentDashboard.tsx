import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, CheckCircle, AlertCircle, Calendar, Award, TrendingUp, BookOpen } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/db';
import { Assignment, Exam, Submission, User } from '../../types';
import { formatDate } from '../../utils/helpers';

const StatCard: React.FC<{ title: string; value: string | number; icon: any; color: string; desc: string }> = ({ 
  title, value, icon: Icon, color, desc
}) => (
  <Card className="flex items-center gap-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-full ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  </Card>
);

const AssignmentItem: React.FC<{ assignment: Assignment; examName: string }> = ({ assignment, examName }) => {
  const now = new Date();
  const start = new Date(assignment.startTime);
  const end = new Date(assignment.endTime);
  
  let status = 'OPEN';
  if (assignment.status === 'CLOSED' || now > end) status = 'CLOSED';
  else if (now < start) status = 'UPCOMING';

  const isAvailable = status === 'OPEN';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors">
      <div className="flex items-start gap-4 mb-3 sm:mb-0">
        <div className={`p-3 rounded-lg ${isAvailable ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
          <Clock size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900">{examName}</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
               <Calendar size={14} /> Hạn chót: {formatDate(end)} {end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            </span>
            <span>•</span>
            <span>{assignment.duration} phút</span>
          </div>
        </div>
      </div>
      <div>
        {status === 'UPCOMING' ? (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
            Sắp mở
          </span>
        ) : status === 'CLOSED' ? (
           <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
            Đã đóng
          </span>
        ) : (
          <Button size="sm" className="text-sm" onClick={() => window.location.hash = '#/exam'}>
            Làm bài ngay
          </Button>
        )}
      </div>
    </div>
  );
};

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  
  // State
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [classmates, setClassmates] = useState<User[]>([]);
  
  // Derived Stats
  const [rank, setRank] = useState(0);
  const [avgScore, setAvgScore] = useState('0.0');
  const [completedCount, setCompletedCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if (user?.classId) {
      // 1. Assignments (Filter out DRAFTS)
      const allAssignments = db.assignments.getAll();
      const filteredAssign = allAssignments
        .filter(a => a.classId === user.classId && a.status !== 'DRAFT')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyAssignments(filteredAssign);

      // 2. Base Data
      const allExams = db.exams.getAll();
      setExams(allExams);
      
      const allUsers = db.users.getAll();
      const myClassmates = allUsers.filter(u => u.classId === user.classId && u.role === 'STUDENT');
      setClassmates(myClassmates);

      const allSubmissions = db.submissions.getAll();
      
      // 3. Calculate My Stats
      const mySubs = allSubmissions.filter(s => s.studentId === user.id);
      setSubmissions(mySubs);
      setCompletedCount(mySubs.length);
      
      const myAvg = mySubs.length > 0 
        ? mySubs.reduce((acc, s) => acc + s.score, 0) / mySubs.length 
        : 0;
      setAvgScore(myAvg.toFixed(1));

      // 4. Calculate Leaderboard & Rank
      const classStats = myClassmates.map(student => {
        const sub = allSubmissions.filter(s => s.studentId === student.id);
        const avg = sub.length > 0 ? sub.reduce((acc, s) => acc + s.score, 0) / sub.length : 0;
        return {
          id: student.id,
          name: student.name,
          avg: avg,
          count: sub.length
        };
      });

      // Sort by Avg Score DESC
      classStats.sort((a, b) => b.avg - a.avg);

      // Find my rank
      const myRankIndex = classStats.findIndex(s => s.id === user.id);
      setRank(myRankIndex !== -1 ? myRankIndex + 1 : 0);

      // Set Leaderboard (Top 5)
      setLeaderboard(classStats.slice(0, 5));
    }
  }, [user]);

  const getExamTitle = (id: string) => exams.find(e => e.id === id)?.title || 'Bài kiểm tra';

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <PlayCircle size={200} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold mb-2">Chào mừng trở lại, {user?.name}!</h1>
          <p className="text-blue-100 mb-6">
            {myAssignments.filter(a => a.status === 'OPEN' && new Date() < new Date(a.endTime) && new Date() >= new Date(a.startTime)).length > 0 
              ? "Bạn có bài kiểm tra đang diễn ra. Hãy hoàn thành đúng hạn nhé."
              : "Hôm nay chưa có bài tập nào cần gấp. Hãy ôn tập kiến thức cũ nhé."
            }
          </p>
          <Button 
            className="bg-white text-blue-700 hover:bg-blue-50 border-none font-semibold"
            onClick={() => window.location.hash = '#/exam'}
          >
            Vào thi ngay
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Bài đã làm" 
          value={`${completedCount} bài`} 
          icon={CheckCircle} 
          color="bg-green-500"
          desc="Tổng số bài tập đã nộp"
        />
        <StatCard 
          title="Điểm trung bình" 
          value={avgScore} 
          icon={TrendingUp} 
          color="bg-blue-500"
          desc="Trên thang điểm 10"
        />
        <StatCard 
          title="Xếp hạng lớp" 
          value={rank > 0 ? `Hạng ${rank}` : '-'} 
          icon={Award} 
          color="bg-yellow-500"
          desc={`Trên tổng số ${classmates.length} học sinh`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Assignments Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="text-orange-500" size={24} />
              Bài tập & Kiểm tra
            </h2>
          </div>
          
          <div className="space-y-4">
            {myAssignments.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                Hiện tại chưa có bài tập nào được giao cho lớp của bạn.
              </div>
            ) : (
              myAssignments.map(assign => (
                <AssignmentItem 
                  key={assign.id} 
                  assignment={assign} 
                  examName={getExamTitle(assign.examId)} 
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="text-blue-500" size={24} />
              Khóa học đang học
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="!p-4 border border-gray-100 flex gap-4 hover:shadow-md cursor-pointer transition-shadow">
                 <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                    <img src="https://picsum.photos/100/100?random=1" className="w-full h-full object-cover" />
                 </div>
                 <div>
                    <h4 className="font-bold text-gray-900 line-clamp-1">Khoa học tự nhiên 6</h4>
                    <div className="w-32 bg-gray-200 rounded-full h-1.5 mt-2">
                       <div className="bg-blue-600 h-1.5 rounded-full" style={{width: '45%'}}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">45% hoàn thành</p>
                 </div>
              </Card>
              <Card className="!p-4 border border-gray-100 flex gap-4 hover:shadow-md cursor-pointer transition-shadow">
                 <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                    <img src="https://picsum.photos/100/100?random=2" className="w-full h-full object-cover" />
                 </div>
                 <div>
                    <h4 className="font-bold text-gray-900 line-clamp-1">Toán học 6 - Đại số</h4>
                    <div className="w-32 bg-gray-200 rounded-full h-1.5 mt-2">
                       <div className="bg-green-600 h-1.5 rounded-full" style={{width: '70%'}}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">70% hoàn thành</p>
                 </div>
              </Card>
          </div>
        </div>

        {/* Class Leaderboard */}
        <div>
          <Card className="h-full bg-gradient-to-b from-white to-gray-50">
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
              <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                <Award size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Bảng xếp hạng lớp</h3>
                <p className="text-xs text-gray-500">Cập nhật theo thời gian thực</p>
              </div>
            </div>

            <div className="space-y-2">
              {leaderboard.map((student, idx) => {
                const isMe = student.id === user?.id;
                return (
                  <div 
                    key={student.id} 
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isMe 
                        ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                        : 'bg-white hover:bg-gray-100 border border-gray-100'
                    }`}
                  >
                    <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full font-bold ${
                      isMe ? 'bg-white/20 text-white' : 
                      idx === 0 ? 'bg-yellow-100 text-yellow-600' :
                      idx === 1 ? 'bg-gray-200 text-gray-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-50 text-gray-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-gray-800'}`}>
                        {student.name} {isMe && '(Tôi)'}
                      </p>
                      <p className={`text-xs ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>
                        {student.count} bài thi
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${isMe ? 'text-white' : 'text-gray-900'}`}>
                        {student.avg.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {leaderboard.length === 0 && (
                 <div className="text-center py-8 text-gray-400 text-sm">Chưa có dữ liệu xếp hạng</div>
              )}
            </div>
            
            {rank > 5 && (
              <div className="mt-4 pt-4 border-t text-center text-sm text-gray-500">
                Bạn đang đứng thứ <span className="font-bold text-gray-900">{rank}</span> trong lớp
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};