import React, { useState, useEffect } from 'react';
import { Plus, Calculator, Shuffle, AlertCircle, CheckCircle, FileText, X, Search, Eye, Clock, Hash, BookOpen, Layers, Copy } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { useAuth } from '../../hooks/useAuth';
import { Grade, Subject, Topic, Lesson, Exam, QuestionLevel, Question } from '../../types';
import { formatDate } from '../../utils/helpers';

const LEVEL_LABELS: Record<QuestionLevel, string> = {
  [QuestionLevel.RECOGNITION]: 'Nhận biết',
  [QuestionLevel.UNDERSTANDING]: 'Thông hiểu',
  [QuestionLevel.APPLICATION]: 'Vận dụng',
  [QuestionLevel.HIGH_APPLICATION]: 'Vận dụng cao',
};

const LEVEL_COLORS: Record<QuestionLevel, string> = {
  [QuestionLevel.RECOGNITION]: 'bg-green-100 text-green-700',
  [QuestionLevel.UNDERSTANDING]: 'bg-blue-100 text-blue-700',
  [QuestionLevel.APPLICATION]: 'bg-yellow-100 text-yellow-700',
  [QuestionLevel.HIGH_APPLICATION]: 'bg-red-100 text-red-700',
};

export const ExamManagerPage: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Preview State ---
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);

  // --- Form Data States ---
  const [title, setTitle] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(45);
  const [variantCount, setVariantCount] = useState(1);
  
  // Matrix State
  const [matrix, setMatrix] = useState<Record<QuestionLevel, number>>({
    [QuestionLevel.RECOGNITION]: 0,
    [QuestionLevel.UNDERSTANDING]: 0,
    [QuestionLevel.APPLICATION]: 0,
    [QuestionLevel.HIGH_APPLICATION]: 0,
  });

  // Data Loading States
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  
  // Validation State
  const [availableQuestions, setAvailableQuestions] = useState<Record<QuestionLevel, number>>({
    [QuestionLevel.RECOGNITION]: 0,
    [QuestionLevel.UNDERSTANDING]: 0,
    [QuestionLevel.APPLICATION]: 0,
    [QuestionLevel.HIGH_APPLICATION]: 0,
  });

  useEffect(() => {
    setExams(db.exams.getAll());
    setGrades(db.grades.getAll());
  }, []);

  // Cascading Loaders
  useEffect(() => {
    if (gradeId) setSubjects(db.getSubjectsByGrade(gradeId));
    else setSubjects([]);
  }, [gradeId]);

  useEffect(() => {
    if (subjectId) setTopics(db.getTopicsBySubject(subjectId));
    else setTopics([]);
  }, [subjectId]);

  useEffect(() => {
    if (topicId) setLessons(db.getLessonsByTopic(topicId));
    else setLessons([]);
  }, [topicId]);

  // Calculate Availability Logic
  useEffect(() => {
    if (selectedLessonIds.length === 0) {
      setAvailableQuestions({
        [QuestionLevel.RECOGNITION]: 0,
        [QuestionLevel.UNDERSTANDING]: 0,
        [QuestionLevel.APPLICATION]: 0,
        [QuestionLevel.HIGH_APPLICATION]: 0,
      });
      return;
    }

    // Fetch all questions
    const allQ = db.questions.getAll();
    const counts = {
      [QuestionLevel.RECOGNITION]: 0,
      [QuestionLevel.UNDERSTANDING]: 0,
      [QuestionLevel.APPLICATION]: 0,
      [QuestionLevel.HIGH_APPLICATION]: 0,
    };

    allQ.forEach(q => {
      if (selectedLessonIds.includes(q.lessonId)) {
        counts[q.level]++;
      }
    });

    setAvailableQuestions(counts);
  }, [selectedLessonIds]);

  const handleCreateOpen = () => {
    setTitle('');
    setGradeId('');
    setSubjectId('');
    setTopicId('');
    setSelectedLessonIds([]);
    setMatrix({
      [QuestionLevel.RECOGNITION]: 5,
      [QuestionLevel.UNDERSTANDING]: 3,
      [QuestionLevel.APPLICATION]: 1,
      [QuestionLevel.HIGH_APPLICATION]: 1,
    });
    setVariantCount(4);
    setIsModalOpen(true);
  };

  const handleClone = (sourceExam: Exam) => {
    setTitle(`${sourceExam.title} (Bản sao)`);
    setGradeId(sourceExam.gradeId);
    setSubjectId(sourceExam.subjectId);
    setTopicId(sourceExam.topicId || '');
    setDuration(sourceExam.duration);
    setVariantCount(sourceExam.variants.length || 1);
    setSelectedLessonIds(sourceExam.structure.lessonIds);
    setMatrix(sourceExam.structure.levelCounts);
    
    // Open modal to allow editing before saving
    setIsModalOpen(true);
  };

  const toggleLesson = (id: string) => {
    setSelectedLessonIds(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const shuffleArray = (array: any[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const handleCreateExam = () => {
    // 1. Validation
    if (!title || !gradeId || !subjectId || selectedLessonIds.length === 0) {
      alert("Vui lòng nhập đầy đủ thông tin chung và chọn bài học!");
      return;
    }

    let isValid = true;
    let totalQ = 0;
    (Object.keys(matrix) as QuestionLevel[]).forEach(level => {
      if (matrix[level] > availableQuestions[level]) {
        isValid = false;
      }
      totalQ += matrix[level];
    });

    if (!isValid) {
      alert("Số lượng câu hỏi yêu cầu vượt quá số lượng câu hỏi hiện có trong ngân hàng!");
      return;
    }

    if (totalQ === 0) {
      alert("Tổng số câu hỏi không được bằng 0");
      return;
    }

    // 2. Question Selection
    const allQ = db.questions.getAll();
    let examPool: Question[] = [];

    (Object.keys(matrix) as QuestionLevel[]).forEach(level => {
      const count = matrix[level];
      if (count > 0) {
        // Filter questions by selected lessons and level
        const levelPool = allQ.filter(q => selectedLessonIds.includes(q.lessonId) && q.level === level);
        // Randomly select 'count' questions
        const selected = shuffleArray(levelPool).slice(0, count);
        examPool = [...examPool, ...selected];
      }
    });

    // 3. Variant Generation
    const variants = [];
    for (let i = 0; i < variantCount; i++) {
      const code = (101 + i).toString();
      // Shuffle questions for this variant
      const shuffledQIds = shuffleArray(examPool).map(q => q.id);
      variants.push({ code, questionIds: shuffledQIds });
    }

    // 4. Save
    const newExam: Exam = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      gradeId,
      subjectId,
      topicId,
      duration,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      structure: {
        lessonIds: selectedLessonIds,
        levelCounts: matrix,
        totalQuestions: totalQ
      },
      variants
    };

    db.exams.add(newExam);
    db.logActivity(user, 'Tạo đề thi mới', `Tạo đề thi: ${newExam.title} (${totalQ} câu, ${variantCount} mã đề)`);
    
    setExams(db.exams.getAll());
    setIsModalOpen(false);
    alert(`Đã tạo đề thi thành công với ${variantCount} mã đề!`);
  };

  const handlePreview = (exam: Exam) => {
    setPreviewExam(exam);
    // Load first variant questions
    if (exam.variants && exam.variants.length > 0) {
      const firstVariant = exam.variants[0];
      const qs = firstVariant.questionIds
        .map(id => db.questions.getById(id))
        .filter(q => q !== undefined) as Question[];
      setPreviewQuestions(qs);
    } else {
      setPreviewQuestions([]);
    }
  };

  const handleClosePreview = () => {
    setPreviewExam(null);
    setPreviewQuestions([]);
  };

  // Filter Exams
  const filteredExams = exams.filter(e => {
    if (!searchTerm) return true;
    return e.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý đề thi</h1>
        <div className="flex gap-3 w-full sm:w-auto">
          {/* Search Bar */}
          <div className="flex-1 sm:flex-none flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm đề thi..." 
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
          <Button onClick={handleCreateOpen} className="flex items-center gap-2 whitespace-nowrap">
            <Plus size={20} /> Tạo đề mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExams.map(exam => (
          <Card key={exam.id} className="hover:shadow-md transition-shadow relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <FileText size={24} />
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                {exam.variants.length} Mã đề
              </span>
            </div>
            <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-2 min-h-[56px]">{exam.title}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {formatDate(new Date(exam.createdAt))} • {exam.duration} phút
            </p>
            <div className="border-t pt-4 text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Số câu hỏi:</span>
                <span className="font-medium">{exam.structure.totalQuestions} câu</span>
              </div>
              <div className="flex justify-between">
                <span>Phạm vi:</span>
                <span className="font-medium">{exam.structure.lessonIds.length} bài học</span>
              </div>
            </div>
            
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => handlePreview(exam)}
                 className="bg-white text-blue-500 hover:text-blue-700 p-1.5 rounded-full shadow-sm border border-gray-200"
                 title="Xem trước"
               >
                 <Eye size={18} />
               </button>
               <button 
                 onClick={() => handleClone(exam)}
                 className="bg-white text-indigo-500 hover:text-indigo-700 p-1.5 rounded-full shadow-sm border border-gray-200"
                 title="Nhân bản đề"
               >
                 <Copy size={18} />
               </button>
               <button 
                 onClick={() => { 
                    if(confirm('Xóa đề thi?')) { 
                      db.exams.remove(exam.id); 
                      db.logActivity(user, 'Xóa đề thi', `Xóa đề thi: ${exam.title}`);
                      setExams(db.exams.getAll()); 
                    } 
                 }} 
                 className="bg-white text-red-500 hover:text-red-700 p-1.5 rounded-full shadow-sm border border-gray-200"
                 title="Xóa"
               >
                 <X size={18} />
               </button>
            </div>
          </Card>
        ))}
        {exams.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <FileText size={48} className="mb-4 opacity-50" />
            <p>Chưa có đề thi nào được tạo</p>
          </div>
        )}
        {exams.length > 0 && filteredExams.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
             Không tìm thấy đề thi nào phù hợp với từ khóa "{searchTerm}"
          </div>
        )}
      </div>

      {/* CREATE EXAM MODAL - FULL SCREEN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Cấu hình đề thi</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* COLUMN 1: SCOPE */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">1</span>
                    Thông tin chung & Phạm vi
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên đề thi</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" 
                        placeholder="VD: Kiểm tra 15 phút - KHTN 6"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian (phút)</label>
                        <input 
                          type="number" 
                          className="w-full p-2 border rounded"
                          value={duration}
                          onChange={(e) => setDuration(parseInt(e.target.value))} 
                        />
                      </div>
                      <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Số mã đề (trộn)</label>
                         <input 
                          type="number" 
                          className="w-full p-2 border rounded"
                          value={variantCount}
                          onChange={(e) => setVariantCount(parseInt(e.target.value))} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <select 
                        className="w-full p-2 border rounded"
                        value={gradeId}
                        onChange={(e) => setGradeId(e.target.value)}
                       >
                         <option value="">-- Chọn Khối --</option>
                         {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                       </select>
                       <select 
                        className="w-full p-2 border rounded"
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                        disabled={!gradeId}
                       >
                         <option value="">-- Chọn Môn --</option>
                         {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>

                    <select 
                      className="w-full p-2 border rounded"
                      value={topicId}
                      onChange={(e) => setTopicId(e.target.value)}
                      disabled={!subjectId}
                    >
                      <option value="">-- Chọn Chủ đề (để lọc bài học) --</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-2 sticky top-0 bg-gray-50 pb-2">Chọn bài học:</p>
                      {lessons.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Vui lòng chọn chủ đề để xem bài học</p>
                      ) : (
                        lessons.map(l => (
                          <div key={l.id} className="flex items-center gap-2 mb-2">
                            <input 
                              type="checkbox" 
                              id={`lesson-${l.id}`}
                              checked={selectedLessonIds.includes(l.id)}
                              onChange={() => toggleLesson(l.id)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <label htmlFor={`lesson-${l.id}`} className="text-sm text-gray-700 cursor-pointer select-none">
                              {l.title}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: MATRIX */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">2</span>
                    Cấu trúc ma trận đề
                  </h3>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="grid grid-cols-4 gap-4 text-center mb-2 font-semibold text-xs text-gray-600 uppercase">
                      <div>Mức độ</div>
                      <div>Ngân hàng</div>
                      <div>Yêu cầu</div>
                      <div>Trạng thái</div>
                    </div>
                    
                    {(Object.keys(LEVEL_LABELS) as QuestionLevel[]).map(level => {
                      const available = availableQuestions[level];
                      const requested = matrix[level];
                      const isError = requested > available;

                      return (
                        <div key={level} className="grid grid-cols-4 gap-4 items-center mb-3">
                          <div className="text-sm font-medium text-gray-800 text-left">
                            {LEVEL_LABELS[level]}
                          </div>
                          <div className="text-sm text-gray-600 font-mono bg-white py-1 rounded border">
                            {available}
                          </div>
                          <div>
                            <input 
                              type="number" 
                              min="0"
                              className={`w-full text-center py-1 rounded border font-bold ${isError ? 'border-red-500 text-red-600 bg-red-50' : 'border-gray-300'}`}
                              value={requested}
                              onChange={(e) => setMatrix({...matrix, [level]: parseInt(e.target.value) || 0})}
                            />
                          </div>
                          <div className="flex justify-center" title={isError ? "Không đủ câu hỏi" : ""}>
                            {isError ? (
                              <AlertCircle size={20} className="text-red-500" />
                            ) : (
                              requested > 0 ? <CheckCircle size={20} className="text-green-500" /> : <span className="text-gray-300">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className="mt-4 pt-4 border-t border-blue-200 flex justify-between items-center">
                      <span className="font-bold text-gray-900">Tổng số câu hỏi:</span>
                      <span className="text-xl font-bold text-blue-700">
                        {Object.values(matrix).reduce((a: number, b: number) => a + b, 0)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                    <p className="flex items-start gap-2">
                      <Shuffle size={16} className="mt-0.5" />
                      Hệ thống sẽ tự động lấy ngẫu nhiên câu hỏi từ các bài học đã chọn theo đúng tỷ lệ ma trận và trộn thành {variantCount} mã đề khác nhau.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy bỏ</Button>
              <Button onClick={handleCreateExam} className="flex items-center gap-2">
                <Calculator size={18} /> Tạo và lưu đề thi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW EXAM MODAL */}
      {previewExam && (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-75 flex items-center justify-center p-0">
          <div className="bg-gray-50 w-full h-full flex flex-col">
            {/* Preview Header */}
            <div className="bg-white px-6 py-4 border-b flex justify-between items-center shadow-sm z-10">
              <div className="flex items-center gap-4">
                 <button onClick={handleClosePreview} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={24} className="text-gray-600" />
                 </button>
                 <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                       {previewExam.title} 
                       <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Xem trước</span>
                    </h2>
                    <div className="flex gap-4 text-sm text-gray-500 mt-1">
                       <span className="flex items-center gap-1"><Clock size={14} /> {previewExam.duration} phút</span>
                       <span className="flex items-center gap-1"><Hash size={14} /> Mã đề gốc: {previewExam.variants[0]?.code || '101'}</span>
                       <span className="flex items-center gap-1"><Layers size={14} /> {previewExam.structure.totalQuestions} câu hỏi</span>
                    </div>
                 </div>
              </div>
              <div className="flex gap-2">
                <div className="hidden md:flex gap-2 text-xs font-medium">
                   <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Nhận biết: {previewExam.structure.levelCounts.RECOGNITION}</span>
                   <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Thông hiểu: {previewExam.structure.levelCounts.UNDERSTANDING}</span>
                   <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Vận dụng: {previewExam.structure.levelCounts.APPLICATION}</span>
                   <span className="px-2 py-1 bg-red-100 text-red-700 rounded">Vận dụng cao: {previewExam.structure.levelCounts.HIGH_APPLICATION}</span>
                </div>
                <Button onClick={handleClosePreview} variant="secondary">Đóng xem trước</Button>
              </div>
            </div>

            {/* Preview Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-4xl mx-auto space-y-6 pb-20">
                {previewQuestions.map((q, idx) => (
                   <div key={q.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                      {/* Question Meta */}
                      <div className="absolute top-0 right-0 p-2">
                         <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg ${LEVEL_COLORS[q.level]}`}>
                            {LEVEL_LABELS[q.level]}
                         </span>
                      </div>

                      <div className="flex gap-4">
                         <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                           {idx + 1}
                         </div>
                         <div className="flex-1">
                            <h4 className="text-gray-900 font-medium text-lg mb-4 whitespace-pre-wrap leading-relaxed">
                               {q.content}
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                               {q.answers.map((ans) => (
                                 <div 
                                   key={ans.id} 
                                   className={`p-3 rounded-lg border flex items-center gap-3 ${
                                      ans.isCorrect 
                                        ? 'bg-green-50 border-green-200' 
                                        : 'bg-white border-gray-100'
                                   }`}
                                 >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                       ans.isCorrect ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300'
                                    }`}>
                                       {ans.isCorrect && <CheckCircle size={12} />}
                                    </div>
                                    <span className={`${ans.isCorrect ? 'text-green-800 font-medium' : 'text-gray-600'}`}>
                                       {ans.content}
                                    </span>
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};