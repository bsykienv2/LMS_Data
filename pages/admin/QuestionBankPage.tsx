import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Save, CheckCircle2, XCircle, PlusCircle, Trash, Search, X, AlertTriangle, Upload, Download, FileSpreadsheet, Image as ImageIcon, Check, X as XIcon, Eye, EyeOff, FolderInput, FileText as FileWordIcon, Layers, BookOpen, Bookmark, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { db } from '../../services/db';
import { useAuth } from '../../hooks/useAuth';
import { Grade, Subject, Topic, Lesson, Question, QuestionType, QuestionLevel, Answer } from '../../types';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

// Enums for labels
const LEVEL_LABELS: Record<QuestionLevel, string> = {
  [QuestionLevel.RECOGNITION]: 'Nhận biết',
  [QuestionLevel.UNDERSTANDING]: 'Thông hiểu',
  [QuestionLevel.APPLICATION]: 'Vận dụng',
  [QuestionLevel.HIGH_APPLICATION]: 'Vận dụng cao',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]: 'Trắc nghiệm',
  [QuestionType.TRUE_FALSE]: 'Đúng / Sai',
  [QuestionType.SHORT_ANSWER]: 'Trả lời ngắn',
  [QuestionType.FILL_IN_THE_BLANK]: 'Điền khuyết',
};

export const QuestionBankPage: React.FC = () => {
  const { user } = useAuth();
  // --- Data States ---
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  // --- Filter States ---
  const [filterGradeId, setFilterGradeId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');
  const [filterLessonId, setFilterLessonId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // --- Modal / Form States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportWordModalOpen, setIsImportWordModalOpen] = useState(false);
  
  // --- Hierarchy Modal State ---
  const [hierarchyModalData, setHierarchyModalData] = useState<{
    isOpen: boolean;
    type: 'GRADE' | 'SUBJECT' | 'TOPIC' | 'LESSON';
    id: string;
    name: string;
  }>({ isOpen: false, type: 'GRADE', id: '', name: '' });

  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    answers: [],
    type: QuestionType.MULTIPLE_CHOICE,
    level: QuestionLevel.RECOGNITION
  });
  
  // --- Import States (Shared) ---
  const [importType, setImportType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStats, setImportStats] = useState({ valid: 0, invalid: 0 });
  const [showPreviewDetails, setShowPreviewDetails] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  
  // Import Destination States
  const [importGradeId, setImportGradeId] = useState('');
  const [importSubjectId, setImportSubjectId] = useState('');
  const [importTopicId, setImportTopicId] = useState('');
  const [importLessonId, setImportLessonId] = useState('');

  // Temporary Form States for dropdown logic in Add Modal
  const [formGradeId, setFormGradeId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTopicId, setFormTopicId] = useState('');
  
  // Image Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initial Load
    setGrades(db.grades.getAll());
    setQuestions(db.questions.getAll());
  }, []);

  // --- Cascading Loaders for Main Filter ---
  useEffect(() => {
    if (filterGradeId) setSubjects(db.getSubjectsByGrade(filterGradeId));
    else setSubjects([]);
  }, [filterGradeId]);

  useEffect(() => {
    if (filterSubjectId) setTopics(db.getTopicsBySubject(filterSubjectId));
    else setTopics([]);
  }, [filterSubjectId]);

  useEffect(() => {
    if (filterTopicId) setLessons(db.getLessonsByTopic(filterTopicId));
    else setLessons([]);
  }, [filterTopicId]);

  // --- Cascading Loaders for Import Modal ---
  const [importSubjects, setImportSubjects] = useState<Subject[]>([]);
  const [importTopics, setImportTopics] = useState<Topic[]>([]);
  const [importLessons, setImportLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    if (importGradeId) setImportSubjects(db.getSubjectsByGrade(importGradeId));
    else setImportSubjects([]);
    setImportSubjectId(''); setImportTopicId(''); setImportLessonId('');
  }, [importGradeId]);

  useEffect(() => {
    if (importSubjectId) setImportTopics(db.getTopicsBySubject(importSubjectId));
    else setImportTopics([]);
    setImportTopicId(''); setImportLessonId('');
  }, [importSubjectId]);

  useEffect(() => {
    if (importTopicId) setImportLessons(db.getLessonsByTopic(importTopicId));
    else setImportLessons([]);
    setImportLessonId('');
  }, [importTopicId]);


  // --- Helper: Get Filtered Questions ---
  const getFilteredQuestions = () => {
    return questions.filter(q => {
      // 1. Text Search Filter
      if (searchTerm && !q.content.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // 2. Dropdown Filters
      if (filterLessonId && q.lessonId !== filterLessonId) return false;
      
      if (!filterLessonId) {
        const lesson = db.lessons.getById(q.lessonId);
        if (!lesson) return false;
        
        if (filterTopicId && lesson.topicId !== filterTopicId) return false;
        
        const topic = db.topics.getById(lesson.topicId);
        if (filterSubjectId && topic?.subjectId !== filterSubjectId) return false;
        
        const subject = db.subjects.getById(topic?.subjectId || '');
        if (filterGradeId && subject?.gradeId !== filterGradeId) return false;
      }
      return true;
    });
  };

  // --- Handlers ---
  const handleOpenAdd = () => {
    setFormGradeId(filterGradeId);
    setFormSubjectId(filterSubjectId);
    setFormTopicId(filterTopicId);
    
    if (filterGradeId) setSubjects(db.getSubjectsByGrade(filterGradeId));
    if (filterSubjectId) setTopics(db.getTopicsBySubject(filterSubjectId));
    if (filterTopicId) setLessons(db.getLessonsByTopic(filterTopicId));

    setCurrentQuestion({
      id: '',
      content: '',
      type: QuestionType.MULTIPLE_CHOICE,
      level: QuestionLevel.RECOGNITION,
      lessonId: filterLessonId || '',
      image: '',
      answers: [
        { id: '1', content: '', isCorrect: false },
        { id: '2', content: '', isCorrect: false },
        { id: '3', content: '', isCorrect: false },
        { id: '4', content: '', isCorrect: false },
      ]
    });
    setIsModalOpen(true);
  };

  const resetImportState = () => {
    setImportGradeId('');
    setImportSubjectId('');
    setImportTopicId('');
    setImportLessonId('');
    setPreviewData([]);
    setImportFileName('');
    setShowPreviewDetails(false);
    setImportStats({ valid: 0, invalid: 0 });
  };

  const handleOpenImport = () => {
    resetImportState();
    setIsImportModalOpen(true);
  };

  const handleOpenImportWord = () => {
    resetImportState();
    setIsImportWordModalOpen(true);
  };

  const handleOpenHierarchy = (type: 'GRADE' | 'SUBJECT' | 'TOPIC' | 'LESSON', id: string, name: string) => {
    setHierarchyModalData({ isOpen: true, type, id, name });
  };

  // --- Render Hierarchy Modal Content ---
  const renderHierarchyContent = () => {
    const { type, id } = hierarchyModalData;

    if (type === 'GRADE') {
      const items = db.getSubjectsByGrade(id);
      return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2">Mã Môn</th>
                <th className="px-4 py-2">Tên Môn Học</th>
                <th className="px-4 py-2 text-right">Số chủ đề</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenHierarchy('SUBJECT', item.id, item.name)}>
                  <td className="px-4 py-2 font-mono text-gray-500">{item.id}</td>
                  <td className="px-4 py-2 font-medium text-blue-600 hover:underline">{item.name}</td>
                  <td className="px-4 py-2 text-right">{db.getTopicsBySubject(item.id).length}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Không có môn học nào</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === 'SUBJECT') {
      const items = db.getTopicsBySubject(id);
      return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2">Mã Chủ Đề</th>
                <th className="px-4 py-2">Tên Chủ Đề</th>
                <th className="px-4 py-2 text-right">Số bài học</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenHierarchy('TOPIC', item.id, item.name)}>
                  <td className="px-4 py-2 font-mono text-gray-500">{item.id}</td>
                  <td className="px-4 py-2 font-medium text-blue-600 hover:underline">{item.name}</td>
                  <td className="px-4 py-2 text-right">{db.getLessonsByTopic(item.id).length}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Không có chủ đề nào</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === 'TOPIC') {
      const items = db.getLessonsByTopic(id);
      return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2 w-16">Thứ tự</th>
                <th className="px-4 py-2">Tên Bài Học</th>
                <th className="px-4 py-2 text-right">Số câu hỏi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenHierarchy('LESSON', item.id, item.title)}>
                  <td className="px-4 py-2 text-center text-gray-500">{item.order}</td>
                  <td className="px-4 py-2 font-medium text-blue-600 hover:underline">{item.title}</td>
                  <td className="px-4 py-2 text-right">{db.getQuestionsByLesson(item.id).length}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Không có bài học nào</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === 'LESSON') {
      const lesson = db.lessons.getById(id);
      return (
        <div className="space-y-4">
           <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Nội dung bài học:</h4>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lesson?.content || 'Chưa có nội dung' }}></div>
           </div>
           <div>
              <h4 className="font-bold text-gray-900 mb-2">Câu hỏi trong bài:</h4>
              <div className="flex flex-wrap gap-2">
                 {db.getQuestionsByLesson(id).map((q, idx) => (
                    <div key={q.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 text-xs">
                       Câu {idx + 1} ({LEVEL_LABELS[q.level]})
                    </div>
                 ))}
                 {db.getQuestionsByLesson(id).length === 0 && <span className="text-gray-500 italic text-sm">Chưa có câu hỏi nào.</span>}
              </div>
           </div>
        </div>
      );
    }
  };

  const handleSave = () => {
    if (!currentQuestion.content || !currentQuestion.lessonId) {
      alert("Vui lòng nhập nội dung câu hỏi và chọn bài học!");
      return;
    }

    if (currentQuestion.type === QuestionType.MULTIPLE_CHOICE) {
       const hasCorrect = currentQuestion.answers?.some(a => a.isCorrect);
       if (!hasCorrect) {
         alert("Vui lòng chọn ít nhất một đáp án đúng!");
         return;
       }
    } else if (currentQuestion.type === QuestionType.FILL_IN_THE_BLANK) {
      if (!currentQuestion.content?.includes("___")) {
         alert("Nội dung câu hỏi điền khuyết phải chứa ký tự '___' để đại diện cho chỗ trống.");
         return;
      }
    }

    const newQuestion = {
      ...currentQuestion,
      id: currentQuestion.id || Math.random().toString(36).substr(2, 9),
    } as Question;

    if (currentQuestion.id) {
      db.questions.update(currentQuestion.id, newQuestion);
      db.logActivity(user, 'Cập nhật câu hỏi', `Cập nhật nội dung câu hỏi ID: ${newQuestion.id.substr(0, 4)}...`);
    } else {
      db.questions.add(newQuestion);
      db.logActivity(user, 'Thêm câu hỏi', `Thêm mới câu hỏi vào bài học ID: ${newQuestion.lessonId}`);
      alert("Đã thêm 1 câu hỏi thành công!");
    }

    setQuestions(db.questions.getAll());
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) {
      db.questions.remove(id);
      db.logActivity(user, 'Xóa câu hỏi', `Xóa câu hỏi ID: ${id}`);
      setQuestions(db.questions.getAll());
    }
  };

  const updateAnswer = (idx: number, field: keyof Answer, value: any) => {
    const newAnswers = [...(currentQuestion.answers || [])];
    newAnswers[idx] = { ...newAnswers[idx], [field]: value };
    setCurrentQuestion({ ...currentQuestion, answers: newAnswers });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        alert("File ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setCurrentQuestion({ ...currentQuestion, image: optimizedDataUrl });
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // ... (Keep existing Excel & Word Import Handlers unchanged) ...
  const downloadTemplate = (type: QuestionType) => {
    // ... same as before
    const wb = XLSX.utils.book_new();
    let headers: string[] = [];
    let example: any[] = [];
    let instructions = "Lưu ý: Mức độ nhập số (1: Nhận biết, 2: Thông hiểu, 3: Vận dụng, 4: Vận dụng cao).";

    if (type === QuestionType.MULTIPLE_CHOICE) {
      headers = ["NoiDung", "MucDo", "DapAn1", "Dung1(x)", "DapAn2", "Dung2(x)", "DapAn3", "Dung3(x)", "DapAn4", "Dung4(x)"];
      example = ["Thủ đô của Việt Nam là gì?", 1, "Hà Nội", "x", "TP.HCM", "", "Đà Nẵng", "", "Huế", ""];
      instructions += " Đánh dấu 'x' vào cột Dung nếu đáp án đó đúng.";
    } else if (type === QuestionType.TRUE_FALSE) {
      headers = ["NoiDung", "MucDo", "DapAnDung(Dung/Sai)"];
      example = ["Nước sôi ở 100 độ C", 1, "Dung"];
      instructions += " Nhập 'Dung' hoặc 'Sai' vào cột DapAnDung.";
    } else if (type === QuestionType.SHORT_ANSWER || type === QuestionType.FILL_IN_THE_BLANK) {
      headers = ["NoiDung", "MucDo", "DapAn"];
      example = type === QuestionType.FILL_IN_THE_BLANK 
        ? ["Công thức hóa học của nước là ___", 2, "H2O"]
        : ["Ai là người đầu tiên đặt chân lên mặt trăng?", 1, "Neil Armstrong"];
      if (type === QuestionType.FILL_IN_THE_BLANK) instructions += " Nội dung câu hỏi phải chứa '___' để biểu thị chỗ trống.";
    }

    const ws = XLSX.utils.aoa_to_sheet([
      [instructions], 
      headers,        
      example         
    ]);

    XLSX.utils.book_append_sheet(wb, ws, "MauImport");
    XLSX.writeFile(wb, `Mau_${type}.xlsx`);
  };

  const processImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... same as before
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 1 });
        const processed: any[] = [];
        let valid = 0;
        let invalid = 0;
        jsonData.forEach((row: any, idx) => {
          const content = row['NoiDung'];
          const levelRaw = row['MucDo'];
          let level = QuestionLevel.RECOGNITION;
          if (levelRaw == 2) level = QuestionLevel.UNDERSTANDING;
          if (levelRaw == 3) level = QuestionLevel.APPLICATION;
          if (levelRaw == 4) level = QuestionLevel.HIGH_APPLICATION;
          let isValid = !!content;
          let answers: Answer[] = [];
          if (isValid) {
            if (importType === QuestionType.MULTIPLE_CHOICE) {
              const ansList = [];
              if (row['DapAn1']) ansList.push({ content: row['DapAn1'], isCorrect: !!row['Dung1(x)'] });
              if (row['DapAn2']) ansList.push({ content: row['DapAn2'], isCorrect: !!row['Dung2(x)'] });
              if (row['DapAn3']) ansList.push({ content: row['DapAn3'], isCorrect: !!row['Dung3(x)'] });
              if (row['DapAn4']) ansList.push({ content: row['DapAn4'], isCorrect: !!row['Dung4(x)'] });
              answers = ansList.map((a, i) => ({ id: i.toString(), content: a.content, isCorrect: a.isCorrect }));
              if (answers.length < 2 || !answers.some(a => a.isCorrect)) isValid = false;
            } else if (importType === QuestionType.TRUE_FALSE) {
              const correctVal = String(row['DapAnDung(Dung/Sai)']).toLowerCase().trim();
              if (correctVal !== 'dung' && correctVal !== 'sai') isValid = false;
              else {
                answers = [
                  { id: 'tf1', content: 'Đúng', isCorrect: correctVal === 'dung' },
                  { id: 'tf2', content: 'Sai', isCorrect: correctVal === 'sai' }
                ];
              }
            } else {
              const ansContent = row['DapAn'];
              if (!ansContent) isValid = false;
              else answers = [{ id: '1', content: String(ansContent), isCorrect: true }];
              if (importType === QuestionType.FILL_IN_THE_BLANK && !String(content).includes('___')) isValid = false;
            }
          }
          if (isValid) valid++; else invalid++;
          processed.push({ id: `temp_${idx}`, content, level, type: importType, answers, isValid, error: !isValid ? 'Sai định dạng' : '' });
        });
        setPreviewData(processed);
        setImportStats({ valid, invalid });
        setShowPreviewDetails(false);
        e.target.value = '';
      } catch (error) { console.error(error); alert("Lỗi đọc file Excel!"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadWordTemplate = () => {
    // ... same as before
    let content = "";
    let filename = "";
    if (importType === QuestionType.MULTIPLE_CHOICE) {
      content = `HƯỚNG DẪN IMPORT TRẮC NGHIỆM TỪ WORD...`; 
      filename = "Mau_Word_TracNghiem.doc";
    } else if (importType === QuestionType.TRUE_FALSE) {
      content = `HƯỚNG DẪN IMPORT ĐÚNG/SAI TỪ WORD...`;
      filename = "Mau_Word_DungSai.doc";
    } else if (importType === QuestionType.SHORT_ANSWER) {
      content = `HƯỚNG DẪN IMPORT TRẢ LỜI NGẮN TỪ WORD...`;
      filename = "Mau_Word_TraLoiNgan.doc";
    } else if (importType === QuestionType.FILL_IN_THE_BLANK) {
      content = `HƯỚNG DẪN IMPORT ĐIỀN KHUYẾT TỪ WORD...`;
      filename = "Mau_Word_DienKhuyet.doc";
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processWordFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... same as before
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then((result) => {
          const text = result.value;
          const parsedQuestions = parseWordContent(text);
          setPreviewData(parsedQuestions);
          const valid = parsedQuestions.filter(q => q.isValid).length;
          setImportStats({ valid, invalid: parsedQuestions.length - valid });
          setShowPreviewDetails(false);
        })
        .catch((err) => { console.error(err); alert("Lỗi đọc file Word: " + err.message); });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const parseWordContent = (text: string) => {
    // ... same as before
    const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l);
    const questions: any[] = [];
    let currentQ: any = null;
    const questionStartRegex = /^(Câu\s+\d+[:.])\s*(.*)/i;
    const optionRegex = /^([A-D])\.\s*(.*)/i;
    const answerRegex = /^(Đáp án|Đáp án đúng)\s*[:]\s*(.*)/i;
    const levelRegex = /^(Mức độ)\s*[:]\s*(\d)/i;
    const pushCurrent = () => { if (currentQ) { questions.push(validateParsedQuestion(currentQ)); currentQ = null; } };
    lines.forEach((line) => {
      if (questionStartRegex.test(line)) {
        pushCurrent();
        const match = line.match(questionStartRegex);
        currentQ = {
          content: match ? match[2] : line,
          answers: [], correctText: '', correctChar: '', level: QuestionLevel.RECOGNITION, rawAnswers: {}, type: importType
        };
      } else if (currentQ) {
        if (importType === QuestionType.MULTIPLE_CHOICE) {
           const optMatch = line.match(optionRegex);
           if (optMatch) currentQ.rawAnswers[optMatch[1].toUpperCase()] = optMatch[2];
           else if (answerRegex.test(line)) { const ansMatch = line.match(answerRegex); if (ansMatch) currentQ.correctChar = ansMatch[2].trim().toUpperCase().charAt(0); }
        } else {
           if (answerRegex.test(line)) { const ansMatch = line.match(answerRegex); if (ansMatch) currentQ.correctText = ansMatch[2].trim(); }
        }
        if (levelRegex.test(line)) {
           const lvlMatch = line.match(levelRegex);
           const lvlNum = parseInt(lvlMatch ? lvlMatch[2] : '1');
           if (lvlNum === 2) currentQ.level = QuestionLevel.UNDERSTANDING;
           else if (lvlNum === 3) currentQ.level = QuestionLevel.APPLICATION;
           else if (lvlNum === 4) currentQ.level = QuestionLevel.HIGH_APPLICATION;
        }
        if (!questionStartRegex.test(line) && !optionRegex.test(line) && !answerRegex.test(line) && !levelRegex.test(line)) {
           const isMCandHasOptions = importType === QuestionType.MULTIPLE_CHOICE && Object.keys(currentQ.rawAnswers).length > 0;
           const hasAnswer = !!currentQ.correctText || !!currentQ.correctChar;
           if (!isMCandHasOptions && !hasAnswer) currentQ.content += "\n" + line;
        }
      }
    });
    pushCurrent();
    return questions;
  };

  const validateParsedQuestion = (q: any) => {
    // ... same as before
    let answers: Answer[] = [];
    let isValid = !!q.content;
    let errorMsg = '';
    if (q.type === QuestionType.MULTIPLE_CHOICE) {
       ['A', 'B', 'C', 'D'].forEach((char, idx) => {
          if (q.rawAnswers[char]) {
             answers.push({ id: idx.toString(), content: q.rawAnswers[char], isCorrect: q.correctChar === char });
          }
       });
       if (answers.length < 2) { isValid = false; errorMsg = 'Không đủ đáp án'; }
       else if (!answers.some(a => a.isCorrect)) { isValid = false; errorMsg = 'Thiếu đáp án đúng'; }
    } else if (q.type === QuestionType.TRUE_FALSE) {
       const correctVal = q.correctText.toLowerCase();
       if (correctVal !== 'đúng' && correctVal !== 'sai' && correctVal !== 'dung') { isValid = false; errorMsg = 'Đáp án phải là Đúng hoặc Sai'; }
       else { const isTrue = correctVal === 'đúng' || correctVal === 'dung'; answers = [{ id: '1', content: 'Đúng', isCorrect: isTrue }, { id: '2', content: 'Sai', isCorrect: !isTrue }]; }
    } else {
       if (!q.correctText) { isValid = false; errorMsg = 'Thiếu nội dung đáp án'; }
       else { answers = [{ id: '1', content: q.correctText, isCorrect: true }]; }
       if (q.type === QuestionType.FILL_IN_THE_BLANK && !q.content.includes('___')) { isValid = false; errorMsg = 'Nội dung thiếu "___"'; }
    }
    return { id: Math.random().toString(36).substr(2, 9), content: q.content, type: q.type, level: q.level, answers, isValid, error: errorMsg };
  };

  const handleConfirmImport = (fromType: 'EXCEL' | 'WORD') => {
    if (!importLessonId) { alert("Vui lòng chọn 'Bài học' tại Bước 3 để lưu dữ liệu!"); return; }
    const validQuestions = previewData.filter(q => q.isValid).map(q => ({
      id: Math.random().toString(36).substr(2, 9),
      content: q.content, type: q.type, level: q.level, lessonId: importLessonId, answers: q.answers, image: ''
    } as Question));
    if (validQuestions.length === 0) { alert("Không có câu hỏi hợp lệ để import."); return; }
    validQuestions.forEach(q => db.questions.add(q));
    const lessonTitle = db.lessons.getById(importLessonId)?.title;
    db.logActivity(user, `Import câu hỏi (${fromType})`, `Import ${validQuestions.length} câu hỏi vào bài học: ${lessonTitle}`);
    alert(`Đã import thành công ${validQuestions.length} câu hỏi!`);
    setQuestions(db.questions.getAll());
    if (fromType === 'EXCEL') setIsImportModalOpen(false); else setIsImportWordModalOpen(false);
    setPreviewData([]);
  };

  // --- Render Preview Card ---
  const renderPreview = () => (
    <Card className="h-full bg-blue-50 border-blue-100 sticky top-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-blue-800">Xem trước</h3>
        <span className="text-xs font-semibold bg-blue-200 text-blue-800 px-2 py-1 rounded">
          {LEVEL_LABELS[currentQuestion.level || QuestionLevel.RECOGNITION]}
        </span>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 min-h-[200px] max-h-[500px] overflow-y-auto">
        <div className="prose prose-sm mb-4">
          <p className="font-medium text-gray-900 whitespace-pre-wrap">
            {currentQuestion.content || "Nội dung câu hỏi sẽ hiển thị ở đây..."}
          </p>
          {currentQuestion.image && (
            <img src={currentQuestion.image} alt="Question Attachment" className="mt-2 max-h-48 object-contain rounded border border-gray-200" />
          )}
        </div>

        <div className="space-y-2">
          {currentQuestion.answers?.map((ans, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded border flex items-center gap-3 ${
                ans.isCorrect 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                ans.isCorrect ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300'
              }`}>
                {ans.isCorrect && <CheckCircle2 size={12} />}
              </div>
              <span className={`${ans.isCorrect ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                {ans.content || `Đáp án ${idx + 1}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Ngân hàng câu hỏi</h1>
        <div className="flex gap-2">
           <Button variant="secondary" onClick={handleOpenImportWord} className="flex items-center gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
             <FileWordIcon size={20} /> Import Word
           </Button>
           <Button variant="secondary" onClick={handleOpenImport} className="flex items-center gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
             <FileSpreadsheet size={20} /> Import Excel
           </Button>
           <Button onClick={handleOpenAdd} className="flex items-center gap-2">
             <Plus size={20} /> Thêm câu hỏi
           </Button>
        </div>
      </div>

      {/* Filters (Existing filters code...) */}
      <Card className="bg-gray-50 border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-1 flex items-center gap-2 bg-white px-3 py-2 rounded border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
             <Search size={18} className="text-gray-400" />
             <input 
               type="text"
               placeholder="Tìm nội dung..."
               className="w-full outline-none text-sm"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
             {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
             )}
          </div>

          <select 
            className="p-2 rounded border border-gray-300"
            value={filterGradeId}
            onChange={(e) => setFilterGradeId(e.target.value)}
          >
            <option value="">-- Tất cả Khối --</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <select 
            className="p-2 rounded border border-gray-300"
            value={filterSubjectId}
            onChange={(e) => setFilterSubjectId(e.target.value)}
            disabled={!filterGradeId}
          >
            <option value="">-- Tất cả Môn --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select 
            className="p-2 rounded border border-gray-300"
            value={filterTopicId}
            onChange={(e) => setFilterTopicId(e.target.value)}
            disabled={!filterSubjectId}
          >
            <option value="">-- Tất cả Chủ đề --</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <select 
            className="p-2 rounded border border-gray-300"
            value={filterLessonId}
            onChange={(e) => setFilterLessonId(e.target.value)}
            disabled={!filterTopicId}
          >
            <option value="">-- Tất cả Bài học --</option>
            {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
      </Card>

      {/* Question List */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-sm font-semibold text-white uppercase bg-[#17a2a1]">
              <tr>
                <th className="px-4 py-3 w-12 rounded-tl-lg">ID</th>
                <th className="px-4 py-3">Nội dung câu hỏi</th>
                <th className="px-4 py-3">Khối</th>
                <th className="px-4 py-3">Môn</th>
                <th className="px-4 py-3">Chủ đề</th>
                <th className="px-4 py-3">Bài học</th>
                <th className="px-4 py-3 w-28">Mức độ</th>
                <th className="px-4 py-3 w-24 text-right rounded-tr-lg">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {getFilteredQuestions().map(q => {
                 // Resolve Hierarchy
                 const lesson = db.lessons.getById(q.lessonId);
                 const topic = db.topics.getById(lesson?.topicId || '');
                 const subject = db.subjects.getById(topic?.subjectId || '');
                 const grade = db.grades.getById(subject?.gradeId || '');

                 // Calculate stats
                 const used = q.stats?.used || 0;
                 const correct = q.stats?.correct || 0;
                 const rate = used > 0 ? Math.round((correct / used) * 100) : 0;
                 const isHard = used >= 3 && rate < 40;

                 return (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-gray-400 text-xs font-mono">{q.id.substr(0,4)}...</td>
                    <td className="px-4 py-4 font-medium text-gray-900 max-w-xs">
                      <div className="flex gap-2">
                         {q.image && <ImageIcon size={16} className="text-blue-500 mt-1 flex-shrink-0" />}
                         <div className="line-clamp-2">{q.content}</div>
                      </div>
                      <div className="flex gap-1 mt-1">
                         <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200">
                           {TYPE_LABELS[q.type]}
                         </span>
                         {isHard && (
                           <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200">
                              <AlertTriangle size={8} /> Khó
                           </span>
                         )}
                      </div>
                    </td>
                    
                    {/* HIERARCHY COLUMNS */}
                    <td className="px-4 py-4">
                       {grade ? (
                         <button onClick={() => handleOpenHierarchy('GRADE', grade.id, grade.name)} className="text-blue-600 hover:underline hover:text-blue-800 text-xs font-medium">
                           {grade.name}
                         </button>
                       ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-4">
                       {subject ? (
                         <button onClick={() => handleOpenHierarchy('SUBJECT', subject.id, subject.name)} className="text-blue-600 hover:underline hover:text-blue-800 text-xs font-medium max-w-[100px] truncate block" title={subject.name}>
                           {subject.name}
                         </button>
                       ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-4">
                       {topic ? (
                         <button onClick={() => handleOpenHierarchy('TOPIC', topic.id, topic.name)} className="text-blue-600 hover:underline hover:text-blue-800 text-xs font-medium max-w-[120px] truncate block" title={topic.name}>
                           {topic.name}
                         </button>
                       ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-4">
                       {lesson ? (
                         <button onClick={() => handleOpenHierarchy('LESSON', lesson.id, lesson.title)} className="text-blue-600 hover:underline hover:text-blue-800 text-xs font-medium max-w-[120px] truncate block" title={lesson.title}>
                           {lesson.title}
                         </button>
                       ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>

                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide
                        ${q.level === QuestionLevel.RECOGNITION ? 'bg-green-100 text-green-700' : 
                          q.level === QuestionLevel.UNDERSTANDING ? 'bg-blue-100 text-blue-700' :
                          q.level === QuestionLevel.APPLICATION ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                        {LEVEL_LABELS[q.level]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {getFilteredQuestions().length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    Chưa có câu hỏi nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* HIERARCHY MODAL */}
      <Modal
        isOpen={hierarchyModalData.isOpen}
        onClose={() => setHierarchyModalData({ ...hierarchyModalData, isOpen: false })}
        title={`Chi tiết: ${hierarchyModalData.name}`}
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setHierarchyModalData({ ...hierarchyModalData, isOpen: false })}>Đóng</Button>
          </div>
        }
      >
        <div className="min-h-[200px]">
           {renderHierarchyContent()}
        </div>
      </Modal>

      {/* Add Modal (Existing...) */}
      {isModalOpen && (
        // ... (Keep existing Add Modal) ...
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Thêm câu hỏi mới</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle size={24} />
              </button>
            </div>

            {/* Modal Content - Split View */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Column: Form */}
              <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200 space-y-6">
                
                {/* 1. Classifiers */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Khối lớp</label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={formGradeId}
                      onChange={(e) => {
                        setFormGradeId(e.target.value);
                        setSubjects(db.getSubjectsByGrade(e.target.value));
                      }}
                    >
                      <option value="">Chọn Khối</option>
                      {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={formSubjectId}
                      onChange={(e) => {
                        setFormSubjectId(e.target.value);
                        setTopics(db.getTopicsBySubject(e.target.value));
                      }}
                    >
                      <option value="">Chọn Môn</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={formTopicId}
                      onChange={(e) => {
                        setFormTopicId(e.target.value);
                        setLessons(db.getLessonsByTopic(e.target.value));
                      }}
                    >
                      <option value="">Chọn Chủ đề</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bài học</label>
                    <select 
                      className="w-full p-2 border rounded border-blue-200 bg-blue-50"
                      value={currentQuestion.lessonId}
                      onChange={(e) => setCurrentQuestion({...currentQuestion, lessonId: e.target.value})}
                    >
                      <option value="">Chọn Bài học</option>
                      {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </div>
                </div>

                {/* 2. Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại câu hỏi</label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={currentQuestion.type}
                      onChange={(e) => {
                        const type = e.target.value as QuestionType;
                        // Reset answers structure based on type
                        let newAnswers: Answer[] = [];
                        if (type === QuestionType.TRUE_FALSE) {
                          newAnswers = [
                            { id: 'tf1', content: 'Đúng', isCorrect: true },
                            { id: 'tf2', content: 'Sai', isCorrect: false }
                          ];
                        } else if (type === QuestionType.SHORT_ANSWER || type === QuestionType.FILL_IN_THE_BLANK) {
                            newAnswers = [{ id: '1', content: '', isCorrect: true }];
                        } else {
                          newAnswers = [
                            { id: '1', content: '', isCorrect: false },
                            { id: '2', content: '', isCorrect: false },
                            { id: '3', content: '', isCorrect: false },
                            { id: '4', content: '', isCorrect: false },
                          ];
                        }
                        setCurrentQuestion({ ...currentQuestion, type, answers: newAnswers });
                      }}
                    >
                      <option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm</option>
                      <option value={QuestionType.TRUE_FALSE}>Đúng / Sai</option>
                      <option value={QuestionType.SHORT_ANSWER}>Trả lời ngắn</option>
                      <option value={QuestionType.FILL_IN_THE_BLANK}>Điền khuyết</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ</label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={currentQuestion.level}
                      onChange={(e) => setCurrentQuestion({...currentQuestion, level: e.target.value as QuestionLevel})}
                    >
                      <option value={QuestionLevel.RECOGNITION}>Nhận biết</option>
                      <option value={QuestionLevel.UNDERSTANDING}>Thông hiểu</option>
                      <option value={QuestionLevel.APPLICATION}>Vận dụng</option>
                      <option value={QuestionLevel.HIGH_APPLICATION}>Vận dụng cao</option>
                    </select>
                  </div>
                </div>

                {/* 3. Content & Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung câu hỏi</label>
                  <textarea 
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px] mb-2"
                    placeholder={currentQuestion.type === QuestionType.FILL_IN_THE_BLANK ? "Nhập nội dung, dùng '___' làm chỗ trống. VD: Nước sôi ở ___ độ C." : "Nhập nội dung câu hỏi..."}
                    value={currentQuestion.content}
                    onChange={(e) => setCurrentQuestion({...currentQuestion, content: e.target.value})}
                  />
                  
                  {/* Image Upload Area */}
                  <div className="flex items-center gap-4">
                     <div className="relative">
                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                           <ImageIcon size={16} /> {currentQuestion.image ? 'Thay đổi ảnh' : 'Tải ảnh đính kèm'}
                        </Button>
                        <input 
                           type="file" 
                           ref={fileInputRef} 
                           className="hidden" 
                           accept="image/*" 
                           onChange={handleImageUpload} 
                        />
                     </div>
                     {currentQuestion.image && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                           <Check size={14} /> Ảnh đã tải lên (Đã tối ưu)
                           <button onClick={() => setCurrentQuestion({...currentQuestion, image: ''})} className="text-red-500 hover:text-red-700 p-1">
                              <XIcon size={14} />
                           </button>
                        </div>
                     )}
                  </div>
                </div>

                {/* 4. Answers */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                     <h3 className="text-sm font-bold text-gray-700 uppercase">
                        {currentQuestion.type === QuestionType.SHORT_ANSWER || currentQuestion.type === QuestionType.FILL_IN_THE_BLANK 
                          ? 'Đáp án mẫu' 
                          : 'Các phương án trả lời'}
                     </h3>
                     {currentQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 font-medium">
                           Tích chọn vào cột "Đúng" để đánh dấu đáp án chính xác
                        </span>
                     )}
                  </div>

                  {/* Header Row for Clarity */}
                  {(currentQuestion.type === QuestionType.MULTIPLE_CHOICE || currentQuestion.type === QuestionType.TRUE_FALSE) && (
                    <div className="flex items-center gap-3 mb-2 px-2">
                       <div className="w-10 text-center text-xs font-bold text-gray-500 uppercase" title="Chọn đáp án đúng">Đúng</div>
                       <div className="flex-1 text-xs font-bold text-gray-500 uppercase">Nội dung đáp án</div>
                       <div className="w-8"></div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {currentQuestion.answers?.map((ans, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-3 p-2 rounded transition-all duration-200 ${
                          ans.isCorrect 
                            ? 'bg-green-50 border border-green-200 shadow-sm' 
                            : 'bg-white border border-transparent'
                        }`}
                      >
                        {/* Correct Answer Selector Column */}
                        {(currentQuestion.type === QuestionType.MULTIPLE_CHOICE || currentQuestion.type === QuestionType.TRUE_FALSE) && (
                          <div className="w-10 flex justify-center flex-shrink-0">
                            <input 
                              type="checkbox" 
                              checked={ans.isCorrect}
                              onChange={(e) => {
                                 // Allow multiple selections for checkbox behavior
                                 const updatedAnswers = [...(currentQuestion.answers || [])];
                                 updatedAnswers[idx] = { ...updatedAnswers[idx], isCorrect: e.target.checked };
                                 setCurrentQuestion({ ...currentQuestion, answers: updatedAnswers });
                              }}
                              className="w-5 h-5 text-green-600 focus:ring-green-500 cursor-pointer rounded accent-green-600"
                              title="Đánh dấu là đáp án đúng"
                            />
                          </div>
                        )}

                        {/* Content Input Column */}
                        <div className="flex-1 relative">
                           <input 
                            type="text" 
                            className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                              ans.isCorrect ? 'border-green-400 font-medium text-green-900 bg-white' : 'border-gray-300'
                            }`}
                            placeholder={currentQuestion.type === QuestionType.FILL_IN_THE_BLANK ? "Nhập từ cần điền" : `Nhập nội dung đáp án ${idx + 1}`}
                            value={ans.content}
                            onChange={(e) => updateAnswer(idx, 'content', e.target.value)}
                            readOnly={currentQuestion.type === QuestionType.TRUE_FALSE} 
                          />
                          {ans.isCorrect && (
                             <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                          )}
                        </div>

                        {/* Action Column */}
                        {currentQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                          <button 
                            onClick={() => {
                              const newAns = currentQuestion.answers?.filter((_, i) => i !== idx);
                              setCurrentQuestion({...currentQuestion, answers: newAns});
                            }}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Xóa dòng này"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {currentQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                    <button 
                      onClick={() => setCurrentQuestion({
                        ...currentQuestion, 
                        answers: [...(currentQuestion.answers || []), { id: Date.now().toString(), content: '', isCorrect: false }]
                      })}
                      className="mt-3 text-sm text-blue-600 font-medium flex items-center gap-1 hover:underline pl-14"
                    >
                      <PlusCircle size={16} /> Thêm đáp án khác
                    </button>
                  )}
                </div>

              </div>

              {/* Right Column: Preview */}
              <div className="w-full lg:w-1/3 bg-gray-50 p-6 border-l border-gray-200 overflow-y-auto">
                {renderPreview()}
                
                {/* Note about Images */}
                <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">
                   <p className="font-bold mb-1">Lưu ý về hình ảnh:</p>
                   <p>Hình ảnh tải lên sẽ được tự động nén và tối ưu hóa để đảm bảo tốc độ tải. Sau này hệ thống sẽ hỗ trợ lưu trữ trực tiếp trên Google Drive.</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy bỏ</Button>
              <Button onClick={handleSave} className="flex items-center gap-2">
                <Save size={18} /> Lưu câu hỏi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL EXCEL (Keeping for completeness, same as before) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import câu hỏi từ Excel"
        footer={
           <div className="flex justify-end gap-2 w-full">
             <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>Hủy</Button>
             <Button onClick={() => handleConfirmImport('EXCEL')} disabled={previewData.length === 0 || !importLessonId}>
               <Save size={16} className="mr-2" /> Lưu {importStats.valid} câu hỏi
             </Button>
           </div>
        }
      >
        {/* ... Reuse existing Excel modal content structure ... */}
        <div className="space-y-6">
           <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2">Bước 1: Chọn dạng câu hỏi & Tải mẫu</h4>
              <div className="flex flex-wrap gap-4 items-end">
                 <div className="flex-1">
                    <label className="block text-sm text-blue-700 mb-1">Dạng câu hỏi</label>
                    <select 
                      className="w-full p-2 border border-blue-300 rounded"
                      value={importType}
                      onChange={(e) => {
                         setImportType(e.target.value as QuestionType);
                         setPreviewData([]); 
                         setImportStats({valid:0, invalid:0});
                         setShowPreviewDetails(false);
                         setImportFileName('');
                      }}
                    >
                       <option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm</option>
                       <option value={QuestionType.TRUE_FALSE}>Đúng / Sai</option>
                       <option value={QuestionType.SHORT_ANSWER}>Trả lời ngắn</option>
                       <option value={QuestionType.FILL_IN_THE_BLANK}>Điền khuyết</option>
                    </select>
                 </div>
                 <Button variant="secondary" onClick={() => downloadTemplate(importType)} className="flex items-center gap-2 bg-white">
                    <Download size={16} /> Tải file mẫu .xlsx
                 </Button>
              </div>
           </div>
           
           {/* ... Step 2 & 3 are generic and reused from previous implementation ... */}
           {/* Step 2 */}
           <div>
              <h4 className="font-bold text-gray-900 mb-2">Bước 2: Tải lên & Xem trước</h4>
              {!previewData.length ? (
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={processImportFile}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium">Kéo thả file Excel hoặc nhấn để chọn</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl p-4">
                   <div className="flex items-center justify-between mb-4">
                      <div>
                         <p className="font-bold text-gray-800 flex items-center gap-2">
                            <FileSpreadsheet size={18} className="text-green-600" />
                            {importFileName}
                         </p>
                         <div className="flex items-center gap-4 mt-1 text-sm">
                            <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={14} /> {importStats.valid} Hợp lệ</span>
                            <span className="text-red-600 font-bold flex items-center gap-1"><XCircle size={14} /> {importStats.invalid} Lỗi</span>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <Button variant="secondary" size="sm" onClick={() => { setPreviewData([]); setImportFileName(''); }}>
                            <Upload size={14} className="mr-1" /> Tải lại
                         </Button>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowPreviewDetails(!showPreviewDetails)}
                            className="text-blue-600 hover:text-blue-800"
                         >
                            {showPreviewDetails ? <><EyeOff size={16} className="mr-1" /> Ẩn chi tiết</> : <><Eye size={16} className="mr-1" /> Xem chi tiết</>}
                         </Button>
                      </div>
                   </div>
                   {showPreviewDetails && (
                     <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto mt-2 animate-in fade-in slide-in-from-top-2">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-gray-100 text-gray-600 sticky top-0">
                              <tr>
                                 <th className="px-4 py-2 w-12">STT</th>
                                 <th className="px-4 py-2">Nội dung</th>
                                 <th className="px-4 py-2 w-24">Trạng thái</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                              {previewData.map((row, idx) => (
                                 <tr key={idx} className={row.isValid ? '' : 'bg-red-50'}>
                                    <td className="px-4 py-2 text-center text-gray-500">{idx + 1}</td>
                                    <td className="px-4 py-2 truncate max-w-[200px]" title={row.content}>{row.content || '(Trống)'}</td>
                                    <td className="px-4 py-2 text-xs font-bold">
                                       {row.isValid ? <span className="text-green-600">OK</span> : <span className="text-red-500" title={row.error}>Lỗi</span>}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Step 3 */}
           <div className={`transition-opacity duration-300 ${previewData.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <h4 className="font-bold text-gray-900 mb-2">Bước 3: Chọn nơi lưu trữ</h4>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Khối lớp</label>
                       <select className="w-full p-2 border rounded bg-white" value={importGradeId} onChange={(e) => setImportGradeId(e.target.value)}>
                          <option value="">-- Chọn Khối --</option>
                          {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Môn học</label>
                       <select className="w-full p-2 border rounded bg-white" value={importSubjectId} onChange={(e) => setImportSubjectId(e.target.value)} disabled={!importGradeId}>
                          <option value="">-- Chọn Môn --</option>
                          {importSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chủ đề</label>
                       <select className="w-full p-2 border rounded bg-white" value={importTopicId} onChange={(e) => setImportTopicId(e.target.value)} disabled={!importSubjectId}>
                          <option value="">-- Chọn Chủ đề --</option>
                          {importTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bài học (Đích)</label>
                       <select className={`w-full p-2 border rounded font-medium ${importLessonId ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white'}`} value={importLessonId} onChange={(e) => setImportLessonId(e.target.value)} disabled={!importTopicId}>
                          <option value="">-- Chọn Bài học --</option>
                          {importLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                       </select>
                    </div>
                 </div>
                 {!importLessonId && <div className="mt-3 flex items-center gap-2 text-xs text-orange-600"><FolderInput size={14} /> Vui lòng chọn đầy đủ thông tin để kích hoạt nút Lưu.</div>}
              </div>
           </div>
        </div>
      </Modal>

      {/* IMPORT MODAL WORD */}
      <Modal
        isOpen={isImportWordModalOpen}
        onClose={() => setIsImportWordModalOpen(false)}
        title="Import câu hỏi từ Word"
        footer={
           <div className="flex justify-end gap-2 w-full">
             <Button variant="secondary" onClick={() => setIsImportWordModalOpen(false)}>Hủy</Button>
             <Button onClick={() => handleConfirmImport('WORD')} disabled={previewData.length === 0 || !importLessonId}>
               <Save size={16} className="mr-2" /> Lưu {importStats.valid} câu hỏi
             </Button>
           </div>
        }
      >
        <div className="space-y-6">
           {/* Step 1: Guide */}
           <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2">Bước 1: Chọn dạng & Tải mẫu</h4>
              <div className="flex flex-wrap gap-4 items-end">
                 <div className="flex-1">
                    <label className="block text-sm text-blue-700 mb-1">Dạng câu hỏi</label>
                    <select 
                      className="w-full p-2 border border-blue-300 rounded"
                      value={importType}
                      onChange={(e) => {
                         setImportType(e.target.value as QuestionType);
                         setPreviewData([]); 
                         setImportStats({valid:0, invalid:0});
                         setShowPreviewDetails(false);
                         setImportFileName('');
                      }}
                    >
                       <option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm (A, B, C, D)</option>
                       <option value={QuestionType.TRUE_FALSE}>Đúng / Sai</option>
                       <option value={QuestionType.SHORT_ANSWER}>Trả lời ngắn</option>
                       <option value={QuestionType.FILL_IN_THE_BLANK}>Điền khuyết (___)</option>
                    </select>
                 </div>
                 <Button variant="secondary" onClick={downloadWordTemplate} className="flex items-center gap-2 bg-white">
                    <Download size={16} /> Tải hướng dẫn .doc
                 </Button>
              </div>
           </div>

           {/* Step 2: Upload */}
           <div>
              <h4 className="font-bold text-gray-900 mb-2">Bước 2: Tải lên & Phân tích</h4>
              
              {!previewData.length ? (
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                    <input 
                      type="file" 
                      accept=".docx" 
                      onChange={processWordFile}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium">Kéo thả file Word (.docx) hoặc nhấn để chọn</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl p-4">
                   <div className="flex items-center justify-between mb-4">
                      <div>
                         <p className="font-bold text-gray-800 flex items-center gap-2">
                            <FileWordIcon size={18} className="text-blue-600" />
                            {importFileName}
                         </p>
                         <div className="flex items-center gap-4 mt-1 text-sm">
                            <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={14} /> {importStats.valid} Hợp lệ</span>
                            <span className="text-red-600 font-bold flex items-center gap-1"><XCircle size={14} /> {importStats.invalid} Lỗi</span>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <Button variant="secondary" size="sm" onClick={() => { setPreviewData([]); setImportFileName(''); }}>
                            <Upload size={14} className="mr-1" /> Tải lại
                         </Button>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowPreviewDetails(!showPreviewDetails)}
                            className="text-blue-600 hover:text-blue-800"
                         >
                            {showPreviewDetails ? <><EyeOff size={16} className="mr-1" /> Ẩn chi tiết</> : <><Eye size={16} className="mr-1" /> Xem chi tiết</>}
                         </Button>
                      </div>
                   </div>

                   {/* Toggleable Details Table */}
                   {showPreviewDetails && (
                     <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto mt-2 animate-in fade-in slide-in-from-top-2">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-gray-100 text-gray-600 sticky top-0">
                              <tr>
                                 <th className="px-4 py-2 w-12">STT</th>
                                 <th className="px-4 py-2">Nội dung</th>
                                 <th className="px-4 py-2 w-24">Trạng thái</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                              {previewData.map((row, idx) => (
                                 <tr key={idx} className={row.isValid ? '' : 'bg-red-50'}>
                                    <td className="px-4 py-2 text-center text-gray-500">{idx + 1}</td>
                                    <td className="px-4 py-2 truncate max-w-[200px]" title={row.content}>{row.content || '(Trống)'}</td>
                                    <td className="px-4 py-2 text-xs font-bold">
                                       {row.isValid ? <span className="text-green-600">OK</span> : <span className="text-red-500" title={row.error}>Lỗi</span>}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Step 3: Destination Select */}
           <div className={`transition-opacity duration-300 ${previewData.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <h4 className="font-bold text-gray-900 mb-2">Bước 3: Chọn nơi lưu trữ</h4>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Khối lớp</label>
                       <select 
                          className="w-full p-2 border rounded bg-white"
                          value={importGradeId}
                          onChange={(e) => setImportGradeId(e.target.value)}
                       >
                          <option value="">-- Chọn Khối --</option>
                          {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Môn học</label>
                       <select 
                          className="w-full p-2 border rounded bg-white"
                          value={importSubjectId}
                          onChange={(e) => setImportSubjectId(e.target.value)}
                          disabled={!importGradeId}
                       >
                          <option value="">-- Chọn Môn --</option>
                          {importSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chủ đề</label>
                       <select 
                          className="w-full p-2 border rounded bg-white"
                          value={importTopicId}
                          onChange={(e) => setImportTopicId(e.target.value)}
                          disabled={!importSubjectId}
                       >
                          <option value="">-- Chọn Chủ đề --</option>
                          {importTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bài học (Đích)</label>
                       <select 
                          className={`w-full p-2 border rounded font-medium ${importLessonId ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white'}`}
                          value={importLessonId}
                          onChange={(e) => setImportLessonId(e.target.value)}
                          disabled={!importTopicId}
                       >
                          <option value="">-- Chọn Bài học --</option>
                          {importLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                       </select>
                    </div>
                 </div>
                 {!importLessonId && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-orange-600">
                       <FolderInput size={14} /> Vui lòng chọn đầy đủ thông tin để kích hoạt nút Lưu.
                    </div>
                 )}
              </div>
           </div>
        </div>
      </Modal>
    </div>
  );
};