import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, ArrowRight, AlertCircle, School } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { db } from '../../services/db';
import { useAuth } from '../../hooks/useAuth';

export const ExamEntryPage: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Initial load
    setSchoolName(db.config.getSchoolName());

    // Reactive listener
    const handleConfigChange = () => {
      setSchoolName(db.config.getSchoolName());
    };

    window.addEventListener('lms-config-changed', handleConfigChange);
    return () => window.removeEventListener('lms-config-changed', handleConfigChange);
  }, []);

  const handleStart = () => {
    setError('');
    
    // 1. Validate Code
    const assignment = db.getAssignmentByCode(code.trim().toUpperCase());
    
    if (!assignment) {
      setError('Mã đề thi không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    // 2. Validate Status
    if (assignment.status === 'DRAFT') {
      setError('Đề thi này chưa được công khai.');
      return;
    }

    if (assignment.status === 'CLOSED') {
      setError('Đề thi đã đóng. Bạn không thể làm bài.');
      return;
    }

    // 3. Validate Time (Double check for client-side timing)
    const now = new Date();
    const start = new Date(assignment.startTime);
    const end = new Date(assignment.endTime);

    if (now < start) {
      setError(`Đề thi chưa mở. Thời gian bắt đầu: ${start.toLocaleString('vi-VN')}`);
      return;
    }

    if (now > end) {
      setError('Đề thi đã kết thúc.');
      return;
    }

    // 4. Validate Attempts
    if (user) {
      const submissions = db.getSubmissionsByStudent(assignment.id, user.id);
      if (submissions.length >= assignment.attempts) {
        setError(`Bạn đã hết số lượt làm bài cho phép (${assignment.attempts} lượt).`);
        return;
      }
    }

    // Success -> Navigate to exam
    navigate(`/exam/${assignment.id}/take`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 relative">
      <div className="absolute top-6 left-6 flex items-center gap-2 text-gray-500">
         <School size={20} />
         <span className="font-semibold uppercase tracking-wide">{schoolName}</span>
      </div>

      <div className="w-full max-w-md">
        <button 
          onClick={() => navigate('/app')}
          className="mb-8 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          Quay lại bảng điều khiển
        </button>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
            <div className="relative z-10">
               <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <Hash size={32} className="text-white" />
               </div>
               <h1 className="text-2xl font-bold text-white mb-2">Vào phòng thi</h1>
               <p className="text-blue-100">Nhập mã đề được giáo viên cung cấp</p>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mã đề thi (8 ký tự)</label>
              <input 
                type="text" 
                className="w-full p-4 text-center text-2xl font-mono tracking-widest border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 uppercase placeholder-gray-300 transition-colors"
                placeholder="XXXXXXXX"
                maxLength={8}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              />
            </div>

            {error && (
              <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              fullWidth 
              size="lg" 
              onClick={handleStart}
              disabled={code.length < 8}
              className="py-3 text-lg flex justify-center items-center gap-2"
            >
              Bắt đầu làm bài <ArrowRight size={20} />
            </Button>
          </div>
        </div>
        
        <p className="text-center text-sm text-gray-400 mt-6">
          Hệ thống sẽ tự động tính giờ ngay khi bạn bắt đầu.
        </p>
      </div>
    </div>
  );
};