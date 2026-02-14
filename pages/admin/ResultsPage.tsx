import React, { useState, useEffect } from 'react';
import { Filter, Eye, CheckCircle, XCircle, AlertTriangle, TrendingUp, Users, Award, EyeOff, AlertOctagon, BarChart3, PieChart, Activity, Search, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { Grade, Class, Submission, Assignment, User, Exam, Question, QuestionLevel } from '../../types';
import { formatDate } from '../../utils/helpers';

const LEVEL_LABELS: Record<QuestionLevel, string> = {
  [QuestionLevel.RECOGNITION]: 'Nhận biết',
  [QuestionLevel.UNDERSTANDING]: 'Thông hiểu',
  [QuestionLevel.APPLICATION]: 'Vận dụng',
  [QuestionLevel.HIGH_APPLICATION]: 'Vận dụng cao',
};

export const ResultsPage: React.FC = () => {
  // Data State
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Filter State
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detail Modal State
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Load initial data
    setGrades(db.grades.getAll());
    setClasses(db.classes.getAll());
    setUsers(db.users.getAll());
    setExams(db.exams.getAll());
    setAssignments(db.assignments.getAll());
    setSubmissions(db.submissions.getAll().reverse());
    setQuestions(db.questions.getAll());
  }, []);

  // Helper Functions for UI
  const getStudentName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getStudentClass = (id: string) => {
    const s = users.find(u => u.id === id);
    return classes.find(c => c.id === s?.classId)?.name || 'N/A';
  };
  const getExamName = (assignId: string) => {
    const assign = assignments.find(a => a.id === assignId);
    if (!assign) return 'N/A';
    return exams.find(e => e.id === assign.examId)?.title || 'N/A';
  };

  // Filter Submissions Logic
  const filteredSubmissions = submissions.filter(sub => {
    const student = users.find(u => u.id === sub.studentId);
    if (!student) return false;

    // Filter by Grade (via Class -> Grade)
    if (selectedGradeId) {
       const userClass = classes.find(c => c.id === student.classId);
       if (userClass?.gradeId !== selectedGradeId) return false;
    }

    // Filter by Class
    if (selectedClassId && student.classId !== selectedClassId) return false;

    // Filter by Search Term (Student Name)
    if (searchTerm) {
       if (!student.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }

    return true;
  });

  // --- STATS CALCULATION ---

  // 1. General Stats
  const avgScore = filteredSubmissions.length > 0 
    ? (filteredSubmissions.reduce((acc, curr) => acc + curr.score, 0) / filteredSubmissions.length).toFixed(1)
    : '0.0';
  
  const passCount = filteredSubmissions.filter(s => s.passed).length;
  const failCount = filteredSubmissions.length - passCount;
  const passRate = filteredSubmissions.length > 0
    ? Math.round((passCount / filteredSubmissions.length) * 100)
    : 0;

  const totalViolations = filteredSubmissions.reduce((acc, curr) => acc + (curr.violationCount || 0), 0);

  // 2. Class Stats (Bar Chart Data)
  const getClassStats = () => {
    const stats: Record<string, { total: number, count: number }> = {};
    filteredSubmissions.forEach(sub => {
      const student = users.find(u => u.id === sub.studentId);
      if (student) {
        const cls = classes.find(c => c.id === student.classId);
        if (cls) {
          if (!stats[cls.name]) stats[cls.name] = { total: 0, count: 0 };
          stats[cls.name].total += sub.score;
          stats[cls.name].count += 1;
        }
      }
    });
    return Object.keys(stats).map(name => ({
      name,
      avg: stats[name].count ? (stats[name].total / stats[name].count) : 0
    })).sort((a, b) => b.avg - a.avg);
  };

  // 3. Level Stats (Horizontal Bar Data)
  const getLevelStats = () => {
    const stats: Record<string, { correct: number, total: number }> = {
      [QuestionLevel.RECOGNITION]: { correct: 0, total: 0 },
      [QuestionLevel.UNDERSTANDING]: { correct: 0, total: 0 },
      [QuestionLevel.APPLICATION]: { correct: 0, total: 0 },
      [QuestionLevel.HIGH_APPLICATION]: { correct: 0, total: 0 },
    };

    filteredSubmissions.forEach(sub => {
      sub.answers.forEach(ans => {
        const q = questions.find(q => q.id === ans.questionId);
        if (q) {
          stats[q.level].total += 1;
          const correctAns = q.answers.find(a => a.isCorrect);
          if (correctAns?.id === ans.answerId) {
            stats[q.level].correct += 1;
          }
        }
      });
    });

    return Object.keys(stats).map(key => ({
      key: key as QuestionLevel,
      label: LEVEL_LABELS[key as QuestionLevel],
      percent: stats[key].total ? Math.round((stats[key].correct / stats[key].total) * 100) : 0
    }));
  };

  const classStats = getClassStats();
  const levelStats = getLevelStats();

  const handleViewDetail = (sub: Submission) => {
    setSelectedSubmission(sub);
    setIsModalOpen(true);
  };

  const renderDetailContent = () => {
    if (!selectedSubmission) return null;
    
    const assign = assignments.find(a => a.id === selectedSubmission.assignmentId);
    const exam = exams.find(e => e.id === assign?.examId);
    const violations = selectedSubmission.violationCount || 0;
    
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
           <div>
             <h4 className="font-bold text-lg text-blue-900">{getStudentName(selectedSubmission.studentId)}</h4>
             <p className="text-sm text-blue-700">{exam?.title}</p>
           </div>
           <div className="text-right">
             <div className="text-3xl font-bold text-blue-600">{selectedSubmission.score}</div>
             <div className="text-xs text-blue-500 uppercase">Điểm số</div>
           </div>
        </div>

        {violations > 0 && (
          <div className={`p-4 rounded-lg border flex items-start gap-4 ${violations > 3 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className={`p-2 rounded-full ${violations > 3 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
              <AlertOctagon size={24} />
            </div>
            <div>
              <h4 className={`font-bold ${violations > 3 ? 'text-red-800' : 'text-yellow-800'}`}>
                Phát hiện hành vi đáng ngờ
              </h4>
              <p className={`text-sm mt-1 ${violations > 3 ? 'text-red-700' : 'text-yellow-700'}`}>
                Học sinh này đã rời khỏi màn hình làm bài <strong>{violations} lần</strong>.
                {violations > 3 && " Số lần vi phạm cao, cần xem xét kỹ kết quả."}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
          {selectedSubmission.answers.map((ans, idx) => {
            const question = questions.find(q => q.id === ans.questionId);
            if (!question) return null;

            const correctAns = question.answers.find(a => a.isCorrect);
            const studentAns = question.answers.find(a => a.id === ans.answerId);
            const isCorrect = correctAns?.id === studentAns?.id;

            return (
              <div key={idx} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex gap-3">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {idx + 1}
                   </div>
                   <div className="flex-1">
                     <p className="font-medium text-gray-900 mb-2">{question.content}</p>
                     
                     <div className="text-sm space-y-1">
                       <div className="flex items-center gap-2">
                         <span className="font-medium text-gray-500 w-24">Chọn:</span>
                         <span className={isCorrect ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                           {studentAns?.content || '(Không trả lời)'}
                         </span>
                         {isCorrect ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}
                       </div>
                       
                       {!isCorrect && (
                         <div className="flex items-center gap-2">
                           <span className="font-medium text-gray-500 w-24">Đáp án đúng:</span>
                           <span className="text-green-700 font-bold">{correctAns?.content}</span>
                           <CheckCircle size={16} className="text-green-600" />
                         </div>
                       )}
                     </div>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Kết quả thi & Báo cáo</h1>
        
        {/* Filters */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
          <Filter size={18} className="text-gray-500 ml-2" />
          <select 
            className="px-2 py-1 bg-transparent text-sm focus:outline-none"
            value={selectedGradeId}
            onChange={(e) => setSelectedGradeId(e.target.value)}
          >
            <option value="">Tất cả Khối</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="w-px h-4 bg-gray-300"></div>
          <select 
            className="px-2 py-1 bg-transparent text-sm focus:outline-none"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Tất cả Lớp</option>
            {classes
              .filter(c => !selectedGradeId || c.gradeId === selectedGradeId)
              .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          
          <div className="w-px h-4 bg-gray-300"></div>
          
          <div className="flex items-center gap-1 w-48">
             <Search size={16} className="text-gray-400" />
             <input 
               type="text" 
               placeholder="Tìm tên học sinh..." 
               className="bg-transparent text-sm outline-none w-full"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
             {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
             )}
          </div>
        </div>
      </div>

      {/* --- CHARTS SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Class Average */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-100 rounded text-blue-600">
              <BarChart3 size={20} />
            </div>
            <h3 className="font-bold text-gray-800">Điểm trung bình theo lớp</h3>
          </div>
          <div className="h-48 flex items-end gap-3 justify-center pt-4">
            {classStats.length > 0 ? classStats.map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 group w-12">
                <div className="relative w-full bg-gray-100 rounded-t-lg overflow-hidden flex items-end h-32">
                   <div 
                      className="w-full bg-blue-500 hover:bg-blue-600 transition-all duration-500 rounded-t-lg relative"
                      style={{ height: `${(stat.avg / 10) * 100}%` }}
                   >
                     <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap z-10">
                        {stat.avg.toFixed(1)}
                     </div>
                   </div>
                </div>
                <span className="text-xs font-medium text-gray-600">{stat.name}</span>
              </div>
            )) : (
              <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
            )}
          </div>
        </Card>

        {/* Chart 2: Pass/Fail Ratio */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-100 rounded text-purple-600">
              <PieChart size={20} />
            </div>
            <h3 className="font-bold text-gray-800">Tỷ lệ Đạt / Chưa đạt</h3>
          </div>
          <div className="flex items-center justify-center h-48 gap-6">
             <div className="relative w-32 h-32">
               <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                 {/* Background Circle */}
                 <path
                   className="text-gray-100"
                   d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                   fill="none"
                   stroke="currentColor"
                   strokeWidth="3.8"
                 />
                 {/* Pass Circle */}
                 {filteredSubmissions.length > 0 && (
                   <path
                    className="text-green-500 transition-all duration-1000 ease-out"
                    strokeDasharray={`${passRate}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                   />
                 )}
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-2xl font-bold text-gray-800">{passRate}%</span>
                 <span className="text-xs text-gray-500">Đạt</span>
               </div>
             </div>
             <div className="space-y-3">
               <div className="flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-green-500"></span>
                 <span className="text-sm text-gray-600">Đạt ({passCount})</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-gray-200"></span>
                 <span className="text-sm text-gray-600">Chưa đạt ({failCount})</span>
               </div>
             </div>
          </div>
        </Card>

        {/* Chart 3: Question Level Analysis */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-orange-100 rounded text-orange-600">
              <Activity size={20} />
            </div>
            <h3 className="font-bold text-gray-800">Tỷ lệ đúng theo mức độ</h3>
          </div>
          <div className="space-y-4 h-48 flex flex-col justify-center">
             {levelStats.map((stat) => (
               <div key={stat.key}>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-gray-600 font-medium">{stat.label}</span>
                   <span className="font-bold text-gray-800">{stat.percent}%</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                   <div 
                     className={`h-2.5 rounded-full transition-all duration-700 ${
                        stat.key === QuestionLevel.RECOGNITION ? 'bg-green-500' :
                        stat.key === QuestionLevel.UNDERSTANDING ? 'bg-blue-500' :
                        stat.key === QuestionLevel.APPLICATION ? 'bg-yellow-500' : 'bg-red-500'
                     }`} 
                     style={{ width: `${stat.percent}%` }}
                   ></div>
                 </div>
               </div>
             ))}
          </div>
        </Card>
      </div>

      {/* --- STATS SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4 bg-white border-l-4 border-l-blue-500">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Điểm trung bình</p>
            <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 bg-white border-l-4 border-l-green-500">
          <div className="p-3 bg-green-100 text-green-600 rounded-full">
            <Award size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Tỷ lệ đạt</p>
            <p className="text-2xl font-bold text-gray-900">{passRate}%</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 bg-white border-l-4 border-l-orange-500">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Lượt nộp bài</p>
            <p className="text-2xl font-bold text-gray-900">{filteredSubmissions.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 bg-white border-l-4 border-l-red-500">
          <div className="p-3 bg-red-100 text-red-600 rounded-full">
            <EyeOff size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Tổng vi phạm</p>
            <p className="text-2xl font-bold text-gray-900">{totalViolations}</p>
          </div>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-sm font-semibold text-white uppercase bg-[#17a2a1]">
              <tr>
                <th className="px-6 py-3 rounded-tl-lg">Học sinh</th>
                <th className="px-6 py-3">Lớp</th>
                <th className="px-6 py-3">Bài thi</th>
                <th className="px-6 py-3">Điểm số</th>
                <th className="px-6 py-3">Vi phạm</th>
                <th className="px-6 py-3">Ngày nộp</th>
                <th className="px-6 py-3 text-right rounded-tr-lg">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Chưa có kết quả nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {getStudentName(sub.studentId)}
                    </td>
                    <td className="px-6 py-4">
                      {getStudentClass(sub.studentId)}
                    </td>
                    <td className="px-6 py-4">
                      {getExamName(sub.assignmentId)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded font-bold text-xs ${
                        sub.score >= 7 
                          ? 'bg-green-100 text-green-700' 
                          : sub.score >= 5 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {sub.score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {sub.violationCount > 0 ? (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          <AlertTriangle size={14} /> {sub.violationCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {sub.endTime ? formatDate(new Date(sub.endTime)) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleViewDetail(sub)}>
                        <Eye size={16} /> Xem
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Chi tiết bài làm"
        footer={
          <div className="flex justify-end w-full">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Đóng</Button>
          </div>
        }
      >
        {renderDetailContent()}
      </Modal>
    </div>
  );
};