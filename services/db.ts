import { Grade, Class, Subject, Topic, Lesson, User, Role, Question, Exam, Assignment, Submission, SystemLog, QuestionType, QuestionLevel } from '../types';

// Storage Keys
const KEYS = {
  GRADES: 'lms_grades',
  CLASSES: 'lms_classes',
  SUBJECTS: 'lms_subjects',
  TOPICS: 'lms_topics',
  LESSONS: 'lms_lessons',
  USERS: 'lms_users',
  QUESTIONS: 'lms_questions',
  EXAMS: 'lms_exams',
  ASSIGNMENTS: 'lms_assignments',
  SUBMISSIONS: 'lms_submissions',
  LOGS: 'lms_logs',
  CONFIG: 'lms_config',
};

// --- SAFE STORAGE HELPERS ---
const safeGet = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return fallback;
    if (item === 'undefined') return fallback;
    // Attempt parsing
    return JSON.parse(item);
  } catch (error) {
    console.warn(`Error parsing localStorage key "${key}", resetting to fallback.`, error);
    // If corrupted, remove it to prevent future crashes
    localStorage.removeItem(key);
    return fallback;
  }
};

const safeSet = (key: string, value: any): boolean => {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error: any) {
    console.error(`Error setting localStorage key "${key}":`, error);
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      alert('Bộ nhớ trình duyệt đã đầy! Vui lòng xóa bớt dữ liệu (ví dụ: ảnh, nhật ký) hoặc xuất backup và reset hệ thống.');
    } else {
      alert('Không thể lưu dữ liệu. Vui lòng kiểm tra lại trình duyệt.');
    }
    return false;
  }
};

// Generic CRUD Helper
const createCRUD = <T extends { id: string }>(key: string) => ({
  getAll: (): T[] => {
    return safeGet<T[]>(key, []);
  },
  getById: (id: string): T | undefined => {
    const items = safeGet<T[]>(key, []);
    return items.find((item: T) => item.id === id);
  },
  add: (item: T): boolean => {
    const items = safeGet<T[]>(key, []);
    items.push(item);
    return safeSet(key, items);
  },
  update: (id: string, updates: Partial<T>): boolean => {
    const items = safeGet<T[]>(key, []);
    const index = items.findIndex((item: T) => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      return safeSet(key, items);
    }
    return false;
  },
  remove: (id: string): boolean => {
    let items = safeGet<T[]>(key, []);
    const initialLen = items.length;
    items = items.filter((item: T) => item.id !== id);
    if (items.length !== initialLen) {
      return safeSet(key, items);
    }
    return true;
  }
});

// Export specific data managers
export const db = {
  grades: createCRUD<Grade>(KEYS.GRADES),
  classes: createCRUD<Class>(KEYS.CLASSES),
  subjects: createCRUD<Subject>(KEYS.SUBJECTS),
  topics: createCRUD<Topic>(KEYS.TOPICS),
  lessons: createCRUD<Lesson>(KEYS.LESSONS),
  users: createCRUD<User>(KEYS.USERS),
  questions: createCRUD<Question>(KEYS.QUESTIONS),
  exams: createCRUD<Exam>(KEYS.EXAMS),
  assignments: createCRUD<Assignment>(KEYS.ASSIGNMENTS),
  submissions: createCRUD<Submission>(KEYS.SUBMISSIONS),
  logs: createCRUD<SystemLog>(KEYS.LOGS),
  
  // Config Helper
  config: {
    getAppName: (): string => {
      const config = safeGet<any>(KEYS.CONFIG, {});
      return config.appName || 'LMS Việt';
    },
    getSchoolName: (): string => {
      const config = safeGet<any>(KEYS.CONFIG, {});
      return config.schoolName || 'Trường THCS Tân Lập';
    },
    // Updated Atomic Update Method returning boolean and dispatching event
    update: (updates: { appName?: string; schoolName?: string }): boolean => {
      const config = safeGet<any>(KEYS.CONFIG, {});
      const newConfig = { ...config, ...updates };
      const success = safeSet(KEYS.CONFIG, newConfig);
      
      if (success) {
        // Dispatch event for UI components to update reactively
        window.dispatchEvent(new Event('lms-config-changed'));
      }
      return success;
    }
  },

  // Custom query helpers
  getClassesByGrade: (gradeId: string): Class[] => {
    return db.classes.getAll().filter(c => c.gradeId === gradeId);
  },
  getSubjectsByGrade: (gradeId: string): Subject[] => {
    return db.subjects.getAll().filter(s => s.gradeId === gradeId);
  },
  getTopicsBySubject: (subjectId: string): Topic[] => {
    return db.topics.getAll().filter(t => t.subjectId === subjectId);
  },
  getLessonsByTopic: (topicId: string): Lesson[] => {
    return db.lessons.getAll().filter(l => l.topicId === topicId).sort((a, b) => a.order - b.order);
  },
  getQuestionsByLesson: (lessonId: string): Question[] => {
    return db.questions.getAll().filter(q => q.lessonId === lessonId);
  },
  generateUniqueCode: (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    const existing = db.assignments.getAll().map(a => a.code);
    
    while (!code || existing.includes(code)) {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return code;
  },
  getAssignmentByCode: (code: string): Assignment | undefined => {
    return db.assignments.getAll().find(a => a.code === code);
  },
  getSubmissionsByStudent: (assignmentId: string, studentId: string): Submission[] => {
    return db.submissions.getAll().filter(s => s.assignmentId === assignmentId && s.studentId === studentId);
  },
  
  // STATS UPDATE Logic
  updateQuestionStats: (submission: Submission) => {
    const questions = db.questions.getAll();
    let hasUpdates = false;

    const updatedQuestions = questions.map(q => {
      const subAnswer = submission.answers.find(a => a.questionId === q.id);
      
      if (subAnswer) {
        hasUpdates = true;
        const stats = q.stats || { used: 0, correct: 0 };
        const newUsed = stats.used + 1;
        
        let isCorrect = false;
        const correctAns = q.answers.find(a => a.isCorrect);
        
        if (correctAns && correctAns.id === subAnswer.answerId) {
          isCorrect = true;
        }

        const newCorrect = isCorrect ? stats.correct + 1 : stats.correct;

        return { ...q, stats: { used: newUsed, correct: newCorrect } };
      }
      return q;
    });

    if (hasUpdates) {
      safeSet(KEYS.QUESTIONS, updatedQuestions);
    }
  },

  // LOGGING HELPER
  logActivity: (user: User | null, action: string, details: string) => {
    if (!user) return;
    const log: SystemLog = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      userName: user.name,
      action: action,
      details: details,
      timestamp: new Date().toISOString()
    };
    db.logs.add(log);
  },

  // BACKUP & RESTORE
  getBackupData: () => {
    const backup: Record<string, any> = {};
    Object.values(KEYS).forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          backup[key] = JSON.parse(raw);
        } catch (e) {
          console.error(`Failed to backup key: ${key}`, e);
        }
      }
    });
    return backup;
  },

  restoreBackupData: (data: Record<string, any>) => {
    const validKeys = Object.values(KEYS);
    Object.entries(data).forEach(([key, value]) => {
      if (validKeys.includes(key)) {
        safeSet(key, value);
      }
    });
  }
};

// Seed Data Function
export const seedDatabase = () => {
  const hasGrades = !!localStorage.getItem(KEYS.GRADES);
  if (hasGrades) return;

  console.log('🌱 Seeding database...');

  const grades: Grade[] = [
    { id: 'g6', name: 'Khối 6' },
    { id: 'g7', name: 'Khối 7' },
    { id: 'g8', name: 'Khối 8' },
    { id: 'g9', name: 'Khối 9' },
  ];
  safeSet(KEYS.GRADES, grades);

  const classes: Class[] = [
    { id: 'c6a', name: '6A', gradeId: 'g6', type: 'SELECTED', note: 'Lớp mũi nhọn' },
    { id: 'c7a', name: '7A', gradeId: 'g7', type: 'REGULAR', note: '' },
    { id: 'c8a', name: '8A', gradeId: 'g8', type: 'REGULAR', note: '' },
    { id: 'c9a', name: '9A', gradeId: 'g9', type: 'SELECTED', note: 'Ôn thi chuyên' },
  ];
  safeSet(KEYS.CLASSES, classes);

  const subjects: Subject[] = [
    { id: 's6_khtn', name: 'Khoa học tự nhiên 6', gradeId: 'g6', image: 'https://picsum.photos/id/20/400/225' },
    { id: 's7_khtn', name: 'Khoa học tự nhiên 7', gradeId: 'g7', image: 'https://picsum.photos/id/36/400/225' },
    { id: 's8_khtn', name: 'Khoa học tự nhiên 8', gradeId: 'g8', image: 'https://picsum.photos/id/60/400/225' },
    { id: 's9_khtn', name: 'Khoa học tự nhiên 9', gradeId: 'g9', image: 'https://picsum.photos/id/96/400/225' },
  ];
  safeSet(KEYS.SUBJECTS, subjects);

  const topics: Topic[] = [
    { id: 't6_1', name: 'Chủ đề 1: Chất và sự biến đổi của chất', subjectId: 's6_khtn' },
  ];
  safeSet(KEYS.TOPICS, topics);

  const lessons: Lesson[] = [
    { 
      id: 'l6_1_1', 
      title: 'Bài 1: Giới thiệu về Khoa học tự nhiên', 
      content: '<h2>1. Khái niệm</h2><p>Khoa học tự nhiên là...</p>', 
      topicId: 't6_1',
      order: 1
    },
  ];
  safeSet(KEYS.LESSONS, lessons);

  const questions: Question[] = [
    {
      id: 'q1',
      content: 'Khoa học tự nhiên nghiên cứu về...',
      type: QuestionType.MULTIPLE_CHOICE,
      level: QuestionLevel.RECOGNITION,
      lessonId: 'l6_1_1',
      answers: [
        { id: 'a1', content: 'Các sự vật, hiện tượng trong tự nhiên', isCorrect: true },
        { id: 'a2', content: 'Các sự vật do con người tạo ra', isCorrect: false },
        { id: 'a3', content: 'Tâm lý con người', isCorrect: false },
        { id: 'a4', content: 'Lịch sử xã hội', isCorrect: false },
      ]
    },
    {
      id: 'q2',
      content: 'Vật nào sau đây là vật sống?',
      type: QuestionType.MULTIPLE_CHOICE,
      level: QuestionLevel.UNDERSTANDING,
      lessonId: 'l6_1_1',
      answers: [
        { id: 'a1', content: 'Cây lúa', isCorrect: true },
        { id: 'a2', content: 'Hòn đá', isCorrect: false },
        { id: 'a3', content: 'Cái bàn', isCorrect: false },
        { id: 'a4', content: 'Chiếc xe đạp', isCorrect: false },
      ]
    },
    {
      id: 'q3',
      content: 'Đâu không phải là vai trò của KHTN?',
      type: QuestionType.MULTIPLE_CHOICE,
      level: QuestionLevel.RECOGNITION,
      lessonId: 'l6_1_1',
      answers: [
        { id: 'a1', content: 'Bảo vệ sức khỏe', isCorrect: false },
        { id: 'a2', content: 'Cung cấp thông tin', isCorrect: false },
        { id: 'a3', content: 'Bảo vệ môi trường', isCorrect: false },
        { id: 'a4', content: 'Giữ gìn trật tự an ninh', isCorrect: true },
      ]
    }
  ];
  safeSet(KEYS.QUESTIONS, questions);

  const exams: Exam[] = [
    {
      id: 'exam_demo',
      title: 'Đề kiểm tra 15 phút - KHTN 6 (Mẫu)',
      gradeId: 'g6',
      subjectId: 's6_khtn',
      duration: 15,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      structure: {
        lessonIds: ['l6_1_1'],
        levelCounts: {
          [QuestionLevel.RECOGNITION]: 2,
          [QuestionLevel.UNDERSTANDING]: 1,
          [QuestionLevel.APPLICATION]: 0,
          [QuestionLevel.HIGH_APPLICATION]: 0,
        },
        totalQuestions: 3
      },
      variants: [
        { code: '101', questionIds: ['q1', 'q2', 'q3'] }
      ]
    }
  ];
  safeSet(KEYS.EXAMS, exams);

  const assignments: Assignment[] = [
    {
      id: 'assign_demo',
      examId: 'exam_demo',
      classId: 'c6a',
      code: 'TEST1234',
      status: 'OPEN',
      startTime: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      endTime: new Date(Date.now() + 86400000 * 7).toISOString(), // Next week
      duration: 15,
      attempts: 5,
      settings: { shuffleQuestions: true, shuffleAnswers: true, showResult: true },
      createdAt: new Date().toISOString()
    }
  ];
  safeSet(KEYS.ASSIGNMENTS, assignments);

  const users: User[] = [
    { 
      id: 'u1', name: 'Nguyễn Văn An', email: 'an@lms.vn', role: Role.STUDENT, 
      classId: 'c6a', avatar: 'https://ui-avatars.com/api/?name=Nguyen+An&background=random',
      username: 'an', password: '1', isActive: true, dob: '2012-05-15'
    },
    { 
      id: 'u2', name: 'Trần Thị Bình', email: 'binh@lms.vn', role: Role.STUDENT, 
      classId: 'c6a', avatar: 'https://ui-avatars.com/api/?name=Tran+Binh&background=random',
      username: 'binh', password: '1', isActive: true, dob: '2012-08-20'
    },
    { 
      id: 'hs_test', name: 'Học Sinh Test', email: 'test@lms.vn', role: Role.STUDENT, 
      classId: 'c6a', avatar: 'https://ui-avatars.com/api/?name=Test+User&background=orange',
      username: 'hs', password: '1', isActive: true, dob: '2012-01-01'
    },
    { 
      id: 'admin', name: 'Quản Trị Viên', email: 'admin@lms.vn', role: Role.ADMIN, 
      avatar: 'https://ui-avatars.com/api/?name=Admin&background=2563eb&color=fff',
      username: 'admin', password: '1', isActive: true, dob: '1990-01-01'
    }
  ];
  safeSet(KEYS.USERS, users);

  console.log('✅ Database seeded successfully with demo content!');
};