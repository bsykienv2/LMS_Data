import React, { useState, useEffect } from 'react';
import { Plus, Clock, Users, Calendar, Hash, Send, AlertTriangle, Search, X, FileEdit, CheckCircle, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { useAuth } from '../../hooks/useAuth';
import { Exam, Class, Grade, Assignment } from '../../types';
import { formatDate } from '../../utils/helpers';

export const AssignmentPage: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Data for Form
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Form State
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  
  // Settings
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(45);
  const [attempts, setAttempts] = useState(1);
  
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    refreshAssignments();
    setExams(db.exams.getAll());
    setGrades(db.grades.getAll());
    
    // Default times
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    setStartTime(now.toISOString().slice(0, 16));
    setEndTime(nextHour.toISOString().slice(0, 16));
  }, []);

  const refreshAssignments = () => {
    const all = db.assignments.getAll().reverse();
    const now = new Date();

    // AUTO-CLOSE Logic: Check if expired and still OPEN
    let hasUpdates = false;
    const updated = all.map(a => {
      if (a.status === 'OPEN' && new Date(a.endTime) < now) {
        db.assignments.update(a.id, { status: 'CLOSED' });
        hasUpdates = true;
        return { ...a, status: 'CLOSED' as const };
      }
      return a;
    });

    setAssignments(updated);
  };

  // Filter Classes when Grade changes
  useEffect(() => {
    if (selectedGradeId) {
      setClasses(db.getClassesByGrade(selectedGradeId));
      setSelectedClassId('');
    } else {
      setClasses([]);
    }
  }, [selectedGradeId]);

  // Update Duration when Exam is selected
  useEffect(() => {
    if (selectedExamId) {
      const exam = exams.find(e => e.id === selectedExamId);
      if (exam) {
        setDuration(exam.duration);
      }
    }
  }, [selectedExamId, exams]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    // Reset minimal form state
    setSelectedExamId('');
    setSelectedGradeId('');
    setSelectedClassId('');
    setAttempts(1);
  };

  const handleCreateAssignment = (status: 'DRAFT' | 'OPEN') => {
    if (!selectedExamId || !selectedClassId || !startTime || !endTime) {
      alert("Vui lòng điền đầy đủ thông tin: Đề thi, Lớp, Thời gian bắt đầu/kết thúc.");
      return;
    }

    if (new Date(startTime) >= new Date(endTime)) {
      alert("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    const newAssignment: Assignment = {
      id: Math.random().toString(36).substr(2, 9),
      examId: selectedExamId,
      classId: selectedClassId,
      code: db.generateUniqueCode(),
      status: status,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration: duration,
      attempts: attempts,
      settings: {
        shuffleQuestions,
        shuffleAnswers,
        showResult
      },
      createdAt: new Date().toISOString()
    };

    db.assignments.add(newAssignment);
    const actionText = status === 'OPEN' ? 'Giao đề cho lớp' : 'Tạo nháp đề giao';
    const className = getClassName(selectedClassId);
    db.logActivity(user, actionText, `Giao đề mã ${newAssignment.code} cho lớp ${className}`);

    refreshAssignments();
    setIsModalOpen(false);
    
    if (status === 'OPEN') {
      alert(`Đã giao đề thành công! Mã đề: ${newAssignment.code}`);
    } else {
      alert('Đã lưu bản nháp thành công!');
    }
  };

  const handlePublish = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn giao đề này cho học sinh không?")) {
      db.assignments.update(id, { status: 'OPEN' });
      db.logActivity(user, 'Giao đề (từ nháp)', `Kích hoạt đề giao ID: ${id}`);
      refreshAssignments();
    }
  };

  const handleCloseAssignment = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn đóng đề này? Học sinh sẽ không thể làm bài nữa.")) {
      db.assignments.update(id, { status: 'CLOSED' });
      db.logActivity(user, 'Đóng đề giao', `Đóng thủ công đề giao ID: ${id}`);
      refreshAssignments();
    }
  };

  // Helper to get Names
  const getExamTitle = (id: string) => exams.find(e => e.id === id)?.title || 'Unknown Exam';
  const getClassName = (id: string) => {
    return db.classes.getById(id)?.name || 'Unknown Class';
  };

  // Filter Logic
  const filteredAssignments = assignments.filter(assign => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const code = assign.code.toLowerCase();
    const exam = getExamTitle(assign.examId).toLowerCase();
    const className = getClassName(assign.classId).toLowerCase();
    return code.includes(term) || exam.includes(term) || className.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Giao đề thi</h1>
        <div className="flex w-full sm:w-auto gap-3">
          <div className="flex-1 sm:flex-none flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 shadow-sm">
              <Search size={18} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm mã, đề thi, lớp..." 
                className="w-full sm:w-64 outline-none text-sm bg-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>
          <Button onClick={handleOpenModal} className="flex items-center gap-2 whitespace-nowrap">
            <Send size={20} /> Giao đề mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <Send size={48} className="mb-4 opacity-50" />
            <p>Chưa có đề thi nào được giao</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-sm font-semibold text-white uppercase bg-[#17a2a1]">
                  <tr>
                    <th className="px-6 py-3 rounded-tl-lg">Mã đề</th>
                    <th className="px-6 py-3">Đề thi</th>
                    <th className="px-6 py-3">Lớp</th>
                    <th className="px-6 py-3">Thời gian</th>
                    <th className="px-6 py-3">Trạng thái</th>
                    <th className="px-6 py-3 rounded-tr-lg text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.length === 0 ? (
                     <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Không tìm thấy kết quả</td></tr>
                  ) : (
                    filteredAssignments.map(assign => {
                      const start = new Date(assign.startTime);
                      const end = new Date(assign.endTime);
                      
                      let statusLabel = '';
                      let statusClass = '';

                      switch (assign.status) {
                        case 'DRAFT':
                          statusLabel = 'Nháp';
                          statusClass = 'bg-gray-100 text-gray-600';
                          break;
                        case 'CLOSED':
                          statusLabel = 'Đã đóng';
                          statusClass = 'bg-red-100 text-red-700';
                          break;
                        case 'OPEN':
                          statusLabel = 'Đã giao';
                          statusClass = 'bg-green-100 text-green-700';
                          break;
                        default:
                          statusLabel = 'Không rõ';
                          statusClass = 'bg-gray-100';
                      }

                      return (
                        <tr key={assign.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-mono font-bold text-blue-600">
                            <div className="flex items-center gap-2">
                              <Hash size={14} />
                              {assign.code}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {getExamTitle(assign.examId)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700">
                              <Users size={14} />
                              Lớp {getClassName(assign.classId)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            <div className="flex flex-col text-xs">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} /> {formatDate(start)}
                              </span>
                              <span className="flex items-center gap-1 mt-1">
                                <Clock size={12} /> {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {assign.status === 'DRAFT' && (
                              <Button size="sm" onClick={() => handlePublish(assign.id)} className="flex items-center gap-1">
                                <Send size={14} /> Giao
                              </Button>
                            )}
                            {assign.status === 'OPEN' && (
                              <Button size="sm" variant="danger" onClick={() => handleCloseAssignment(assign.id)} className="flex items-center gap-1">
                                <Lock size={14} /> Đóng
                              </Button>
                            )}
                            {assign.status === 'CLOSED' && (
                              <span className="text-gray-400 text-xs italic">Đã kết thúc</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Giao đề thi cho lớp"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={() => handleCreateAssignment('DRAFT')}>
              <FileEdit size={16} className="mr-1" /> Lưu nháp
            </Button>
            <Button onClick={() => handleCreateAssignment('OPEN')}>
              <Send size={16} className="mr-1" /> Giao ngay
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          
          {/* 1. Selection */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800 border-b pb-2">1. Chọn đối tượng</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đề thi</label>
              <select 
                className="w-full p-2 border rounded"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                <option value="">-- Chọn Đề thi --</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khối</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={selectedGradeId}
                  onChange={(e) => setSelectedGradeId(e.target.value)}
                >
                  <option value="">-- Chọn Khối --</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lớp</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={!selectedGradeId}
                >
                  <option value="">-- Chọn Lớp --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Timing */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800 border-b pb-2">2. Cài đặt thời gian</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bắt đầu</label>
                <input 
                  type="datetime-local" 
                  className="w-full p-2 border rounded"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kết thúc</label>
                <input 
                  type="datetime-local" 
                  className="w-full p-2 border rounded"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thời lượng (phút)</label>
                <input 
                  type="number" 
                  className="w-full p-2 border rounded"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lần làm bài</label>
                <input 
                  type="number" 
                  min="1"
                  className="w-full p-2 border rounded"
                  value={attempts}
                  onChange={(e) => setAttempts(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* 3. Options */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800 border-b pb-2">3. Tùy chọn khác</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Đảo câu hỏi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={shuffleAnswers}
                  onChange={(e) => setShuffleAnswers(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Đảo đáp án</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showResult}
                  onChange={(e) => setShowResult(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Hiển thị đáp án sau khi nộp</span>
              </label>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 text-sm text-blue-800">
             <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
             <p>Hệ thống sẽ tự động sinh mã đề ngẫu nhiên 8 ký tự cho bài tập này sau khi bấm xác nhận.</p>
          </div>

        </div>
      </Modal>
    </div>
  );
};