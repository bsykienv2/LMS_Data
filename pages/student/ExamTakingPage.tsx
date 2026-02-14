import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Grid, AlertTriangle, EyeOff, Save, RotateCcw, ShieldAlert, AlertOctagon } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { useAuth } from '../../hooks/useAuth';
import { Assignment, Exam, Question, SubmissionAnswer, Submission } from '../../types';

export const ExamTakingPage: React.FC = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- State ---
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [schoolName, setSchoolName] = useState('');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> answerId (or text)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Auto-save & Resume State
  const [lastSaved, setLastSaved] = useState<string>('');
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [pendingResumeData, setPendingResumeData] = useState<{answers: Record<string, string>, violations: number} | null>(null);

  // Anti-cheat State
  const [violationCount, setViolationCount] = useState(0);
  const [isViolationModalOpen, setIsViolationModalOpen] = useState(false);

  // Timer Ref
  const timerRef = useRef<any>(null);

  // Storage Keys Helper
  const getStorageKeys = () => {
    const base = `lms_attempt_${assignmentId}_${user?.id}`;
    return {
      startTime: `${base}_start`,
      answers: `${base}_answers`,
      violations: `${base}_violations`,
      variant: `${base}_variant_idx`
    };
  };

  // --- Initialization ---
  useEffect(() => {
    if (!assignmentId || !user) {
      navigate('/app');
      return;
    }

    // Set school name from DB
    setSchoolName(db.config.getSchoolName());

    const loadExamData = () => {
      const assign = db.assignments.getById(assignmentId);
      if (!assign) {
        alert("Không tìm thấy bài tập!");
        navigate('/app');
        return;
      }

      const ex = db.exams.getById(assign.examId);
      if (!ex) {
        alert("Không tìm thấy đề thi gốc!");
        navigate('/app');
        return;
      }

      // CHECK ATTEMPTS on Load to prevent bypass via URL
      const previousSubmissions = db.getSubmissionsByStudent(assignmentId, user.id);
      if (previousSubmissions.length >= assign.attempts) {
         alert("Bạn đã hết lượt làm bài.");
         navigate(`/exam/${previousSubmissions[0].id}/result`); // Redirect to result of first attempt
         return;
      }

      setAssignment(assign);
      setExam(ex);

      const keys = getStorageKeys();

      // 1. Handle Timer & Start Time
      let startTime = parseInt(localStorage.getItem(keys.startTime) || '0');
      if (!startTime) {
        startTime = Date.now();
        localStorage.setItem(keys.startTime, startTime.toString());
      }

      // Calculate remaining time based on absolute start time
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const totalDurationSeconds = assign.duration * 60;
      const remaining = totalDurationSeconds - elapsedSeconds;

      if (remaining <= 0) {
        setTimeLeft(0);
      } else {
        setTimeLeft(remaining);
      }

      // 2. Load Questions (Sticky Variant)
      let qList: Question[] = [];
      const allQuestions = db.questions.getAll();

      // Determine variant
      let variantIdx = -1;
      const savedVariant = localStorage.getItem(keys.variant);
      
      if (ex.variants && ex.variants.length > 0) {
        if (savedVariant !== null) {
          variantIdx = parseInt(savedVariant);
        } else {
          variantIdx = Math.floor(Math.random() * ex.variants.length);
          localStorage.setItem(keys.variant, variantIdx.toString());
        }
        
        const variant = ex.variants[variantIdx];
        if (variant) {
           qList = variant.questionIds
            .map(id => allQuestions.find(q => q.id === id))
            .filter(q => q !== undefined) as Question[];
        }
      } 
      
      // Fallback
      if (qList.length === 0) {
        qList = allQuestions.filter(q => ex.structure.lessonIds.includes(q.lessonId)).slice(0, ex.structure.totalQuestions);
      }
      setQuestions(qList);

      // 3. Check for Saved Progress (The Resume Logic)
      const savedAnswersStr = localStorage.getItem(keys.answers);
      const savedViolationsStr = localStorage.getItem(keys.violations);

      if (savedAnswersStr) {
        // FOUND SAVED DATA: Ask user to resume
        const parsedAnswers = JSON.parse(savedAnswersStr);
        const parsedViolations = savedViolationsStr ? parseInt(savedViolationsStr) : 0;
        
        // If there are answers, show modal. If object is empty, just load it silently (fresh start effectively)
        if (Object.keys(parsedAnswers).length > 0) {
          setPendingResumeData({
            answers: parsedAnswers,
            violations: parsedViolations
          });
          setIsResumeModalOpen(true);
        } else {
           // Empty answers saved, just load normally
           setAnswers({});
        }
      }

      setLoading(false);

      // Trigger auto-submit if time was already up
      if (remaining <= 0) {
         setTimeout(() => handleSubmit(true), 500);
      }
    };

    loadExamData();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [assignmentId, user, navigate]);

  // --- Persistence Listeners (Auto Save) ---
  useEffect(() => {
    if (!loading && !isSubmitting) {
      const keys = getStorageKeys();
      localStorage.setItem(keys.answers, JSON.stringify(answers));
      localStorage.setItem(keys.violations, violationCount.toString());
      
      // Update "Last Saved" timestamp visually
      const now = new Date();
      setLastSaved(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [answers, violationCount, loading, isSubmitting]);

  // --- Anti-cheat Listener ---
  useEffect(() => {
    const triggerViolation = () => {
      // Logic to prevent triggering multiple times for the same event or during modals
      if (!isSubmitting && !loading && !isResumeModalOpen && !isViolationModalOpen) {
        setViolationCount(prev => prev + 1);
        setIsViolationModalOpen(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation();
      }
    };

    const handleBlur = () => {
      triggerViolation();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isSubmitting, loading, isResumeModalOpen, isViolationModalOpen]);

  // --- Timer Logic ---
  useEffect(() => {
    if (!loading && timeLeft > 0 && !isSubmitting) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
             clearInterval(timerRef.current!);
             handleSubmit(true); // Auto submit
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, isSubmitting, timeLeft]);

  // --- Handlers ---
  const handleAnswerSelect = (qId: string, aId: string) => {
    setAnswers(prev => ({ ...prev, [qId]: aId }));
  };

  const handleResumeConfirm = () => {
    if (pendingResumeData) {
      setAnswers(pendingResumeData.answers);
      setViolationCount(pendingResumeData.violations);
      const now = new Date();
      setLastSaved(now.toLocaleTimeString('vi-VN'));
    }
    setIsResumeModalOpen(false);
    setPendingResumeData(null);
  };

  const handleResumeDecline = () => {
    // User wants to start fresh (but time keeps ticking)
    const keys = getStorageKeys();
    localStorage.removeItem(keys.answers);
    // We do NOT remove startTime, as the exam duration is fixed
    setAnswers({});
    setIsResumeModalOpen(false);
    setPendingResumeData(null);
  };

  const handleSubmit = async (auto = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    // 1. Grade the exam
    let scoreCount = 0;
    const submissionAnswers: SubmissionAnswer[] = [];

    questions.forEach(q => {
      const studentAnsId = answers[q.id];
      submissionAnswers.push({ questionId: q.id, answerId: studentAnsId });

      if (studentAnsId) {
        const correctAns = q.answers.find(a => a.isCorrect);
        if (correctAns && correctAns.id === studentAnsId) {
          scoreCount++;
        }
      }
    });

    const total = questions.length;
    const score = total > 0 ? parseFloat(((scoreCount / total) * 10).toFixed(2)) : 0; 
    const passThreshold = 5.0;
    const passed = score >= passThreshold;
    
    // Calculate actual start/end time from storage
    const keys = getStorageKeys();
    const storedStart = parseInt(localStorage.getItem(keys.startTime) || Date.now().toString());

    // 2. Create Submission Record
    const submission: Submission = {
      id: Math.random().toString(36).substr(2, 9),
      assignmentId: assignment!.id,
      studentId: user!.id,
      startTime: new Date(storedStart).toISOString(),
      endTime: new Date().toISOString(),
      answers: submissionAnswers,
      score: score,
      totalQuestions: total,
      passed: passed,
      violationCount: violationCount
    };

    db.submissions.add(submission);
    
    // NEW: Update Question Stats
    db.updateQuestionStats(submission);

    // 3. Clean up storage
    localStorage.removeItem(keys.startTime);
    localStorage.removeItem(keys.answers);
    localStorage.removeItem(keys.violations);
    localStorage.removeItem(keys.variant);

    // 4. Navigate to Result
    if (auto) {
      alert("Hết giờ làm bài! Hệ thống đã tự động nộp bài của bạn.");
    }
    navigate(`/exam/${submission.id}/result`);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading && !pendingResumeData) return <div className="h-screen flex items-center justify-center">Đang tải đề thi...</div>;

  const currentQuestion = questions[currentIndex];
  const progress = Math.round((Object.keys(answers).length / questions.length) * 100);

  // Safety check for empty questions (e.g. malformed exam)
  if (!currentQuestion && !loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold text-red-600 mb-2">Lỗi đề thi</h2>
        <p className="text-gray-600 mb-4">Không tải được câu hỏi. Vui lòng liên hệ giáo viên.</p>
        <Button onClick={() => navigate('/app')}>Quay lại</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-20">
        <div>
          <div className="uppercase text-xs font-bold text-gray-500 tracking-wider mb-0.5">{schoolName}</div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-800">{exam?.title}</h1>
            <span className="hidden sm:inline text-sm text-gray-400">|</span>
            <p className="text-sm text-gray-500">Mã đề: {assignment?.code} • {user?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {violationCount > 0 && (
             <div className="flex items-center gap-2 text-red-600 font-medium bg-red-50 px-3 py-1 rounded-lg">
                <EyeOff size={18} />
                <span className="hidden sm:inline">Vi phạm: {violationCount}</span>
             </div>
          )}
          <div className={`flex items-center gap-2 font-mono text-xl font-bold px-4 py-2 rounded-lg ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
            <Clock size={24} />
            {formatTime(timeLeft)}
          </div>
          <Button onClick={() => setIsConfirmModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            Nộp bài
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Question Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth relative">
           {isResumeModalOpen && (
             <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10"></div>
           )}
           
          <div className="max-w-3xl mx-auto pb-20">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Tiến độ làm bài</span>
                <span>{Object.keys(answers).length}/{questions.length} câu</span>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            {/* Question Card */}
            {currentQuestion && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 min-h-[400px]">
                <div className="flex items-start gap-4 mb-6">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-lg">
                    {currentIndex + 1}
                  </span>
                  <div className="flex-1 pt-2">
                    <h3 className="text-lg text-gray-900 font-medium leading-relaxed whitespace-pre-wrap">
                      {currentQuestion.content}
                    </h3>
                  </div>
                </div>

                <div className="space-y-3 ml-14">
                  {currentQuestion.answers.map((ans) => {
                    const isSelected = answers[currentQuestion.id] === ans.id;
                    return (
                      <label 
                        key={ans.id} 
                        className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-blue-600' : 'border-gray-300'
                        }`}>
                          {isSelected && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
                        </div>
                        <input 
                          type="radio" 
                          name={`q-${currentQuestion.id}`} 
                          className="hidden"
                          checked={isSelected}
                          onChange={() => handleAnswerSelect(currentQuestion.id, ans.id)}
                        />
                        <span className={`text-base ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                          {ans.content}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8">
              <Button 
                variant="secondary" 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-2"
              >
                <ChevronLeft size={20} /> Câu trước
              </Button>

              {/* Auto Save Indicator */}
              {lastSaved && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                  <Save size={14} />
                  <span>Đã lưu tự động lúc {lastSaved}</span>
                </div>
              )}

              <Button 
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex === questions.length - 1}
                className="flex items-center gap-2"
              >
                Câu tiếp theo <ChevronRight size={20} />
              </Button>
            </div>
          </div>
        </main>

        {/* Right: Palette Sidebar */}
        <aside className="w-80 bg-white border-l border-gray-200 overflow-y-auto hidden lg:block relative">
           {isResumeModalOpen && (
             <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10"></div>
           )}
          <div className="p-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Grid size={16} /> Danh sách câu hỏi
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = idx === currentIndex;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`
                      w-10 h-10 rounded-lg text-sm font-medium transition-all
                      ${isCurrent 
                        ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2' 
                        : isAnswered 
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-blue-600"></div>
                  <span>Đang chọn</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div>
                  <span>Đã làm</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
                  <span>Chưa làm</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Xác nhận nộp bài"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Quay lại làm bài</Button>
            <Button onClick={() => handleSubmit(false)}>Nộp bài ngay</Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Bạn có chắc chắn muốn nộp bài?</h3>
          <p className="text-gray-500 mb-6">Vui lòng kiểm tra lại các câu trả lời trước khi kết thúc.</p>
          
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
            <div className="text-center border-r border-gray-200">
              <p className="text-3xl font-bold text-blue-600">{Object.keys(answers).length}</p>
              <p className="text-xs text-gray-500 uppercase mt-1">Đã làm</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-400">{questions.length - Object.keys(answers).length}</p>
              <p className="text-xs text-gray-500 uppercase mt-1">Chưa làm</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Resume Confirmation Modal */}
      <Modal
        isOpen={isResumeModalOpen}
        onClose={() => {}} // Prevent closing by clicking outside
        title="Tiếp tục bài thi?"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={handleResumeDecline}>Làm lại từ đầu</Button>
            <Button onClick={handleResumeConfirm}>Đồng ý tiếp tục</Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <RotateCcw size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Phát hiện bài làm chưa hoàn thành</h3>
          <p className="text-gray-500 mb-4">
            Hệ thống đã tự động lưu bài làm của bạn trước đó. Bạn có muốn khôi phục lại các câu trả lời đã chọn không?
          </p>
           {pendingResumeData && (
              <div className="inline-block px-3 py-1 bg-gray-100 rounded text-xs text-gray-600">
                Đã lưu {Object.keys(pendingResumeData.answers).length} câu trả lời
              </div>
           )}
        </div>
      </Modal>

      {/* Violation Warning Modal */}
      <Modal
        isOpen={isViolationModalOpen}
        onClose={() => {}} // Force user to acknowledge button
        title="CẢNH BÁO VI PHẠM"
        footer={
          <div className="flex justify-center w-full">
            <Button 
              variant={violationCount > 3 ? "danger" : "primary"}
              onClick={() => setIsViolationModalOpen(false)}
              fullWidth
            >
              Tôi đã hiểu và quay lại làm bài
            </Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${violationCount > 3 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
            {violationCount > 3 ? <AlertOctagon size={48} /> : <ShieldAlert size={48} />}
          </div>
          
          <h3 className={`text-xl font-bold mb-2 ${violationCount > 3 ? 'text-red-600 uppercase' : 'text-gray-900'}`}>
            {violationCount > 3 ? 'CẢNH BÁO NGHIÊM TRỌNG' : 'Bạn đang rời khỏi bài kiểm tra'}
          </h3>
          
          <p className="text-gray-600 mb-4">
            Hệ thống phát hiện bạn đã chuyển sang tab khác hoặc cửa sổ khác. 
            Hành động này được ghi nhận là vi phạm quy chế thi.
          </p>

          <div className="inline-flex flex-col items-center justify-center p-4 bg-gray-100 rounded-xl w-full">
            <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Số lần vi phạm</span>
            <span className={`text-4xl font-extrabold mt-1 ${violationCount > 3 ? 'text-red-600' : 'text-gray-900'}`}>
              {violationCount}
            </span>
          </div>

          {violationCount > 3 && (
            <p className="mt-4 text-sm text-red-600 font-medium">
              Bạn đã vi phạm quá nhiều lần. Kết quả bài thi của bạn sẽ được xem xét kỹ lưỡng.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};