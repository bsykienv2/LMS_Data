import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Home, RotateCcw, Award } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { db } from '../../services/db';
import { Submission, Exam } from '../../types';

export const ExamResultPage: React.FC = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    setSchoolName(db.config.getSchoolName());
    if (submissionId) {
      const sub = db.submissions.getById(submissionId);
      if (sub) {
        setSubmission(sub);
        const assign = db.assignments.getById(sub.assignmentId);
        if (assign) {
          const ex = db.exams.getById(assign.examId);
          setExam(ex || null);
        }
      }
    }
  }, [submissionId]);

  if (!submission || !exam) return <div className="h-screen flex items-center justify-center">Đang tải kết quả...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden relative">
        {/* Background Pattern */}
        <div className={`h-40 w-full absolute top-0 left-0 ${submission.passed ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-br from-red-400 to-rose-600'}`}></div>

        <div className="relative pt-16 px-8 pb-8 text-center">
          <div className="absolute top-4 left-0 w-full text-center text-white/80 font-bold uppercase tracking-widest text-xs z-20">
             {schoolName}
          </div>

          {/* Result Icon */}
          <div className="w-24 h-24 bg-white rounded-full mx-auto shadow-lg flex items-center justify-center mb-6 relative z-10">
            {submission.passed ? (
              <Award size={48} className="text-green-500" />
            ) : (
              <XCircle size={48} className="text-red-500" />
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {submission.passed ? 'Chúc mừng! Bạn đã đạt.' : 'Rất tiếc! Bạn chưa đạt.'}
          </h1>
          <p className="text-gray-500 mb-8">{exam.title}</p>

          {/* Score Card */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Điểm số</p>
                <p className={`text-4xl font-extrabold ${submission.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {submission.score}
                  <span className="text-lg text-gray-400 font-normal">/10</span>
                </p>
              </div>
              <div className="text-center border-l border-gray-200 pl-8">
                <p className="text-sm text-gray-500 mb-1">Số câu đúng</p>
                <p className="text-4xl font-extrabold text-gray-800">
                  {Math.round((submission.score / 10) * submission.totalQuestions)}
                  <span className="text-lg text-gray-400 font-normal">/{submission.totalQuestions}</span>
                </p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                 <span className="text-gray-500">Thời gian làm bài</span>
                 <span className="font-medium text-gray-900">
                   {Math.floor((new Date(submission.endTime!).getTime() - new Date(submission.startTime).getTime()) / 1000 / 60)} phút
                 </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/app')} className="w-full flex justify-center items-center gap-2 py-3">
              <Home size={20} /> Về trang chủ
            </Button>
            {/* Optional: Add 'Review Answers' button if assignment settings allow */}
          </div>
        </div>
      </div>
    </div>
  );
};