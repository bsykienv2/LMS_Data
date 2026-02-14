
export enum Role {
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT',
}

export interface User {
  id: string;
  name: string;
  email: string;
  username: string; // Tên đăng nhập
  password?: string; // Mật khẩu
  role: Role;
  avatar?: string;
  dob?: string; // Ngày sinh ISO string
  classId?: string; // Link student to a class
  isActive: boolean; // Trạng thái kích hoạt
}

export interface Grade {
  id: string;
  name: string;
}

export interface Class {
  id: string;
  name: string;
  gradeId: string;
  type?: 'SELECTED' | 'REGULAR'; // SELECTED: Lớp chọn, REGULAR: Lớp thường
  note?: string; // Ghi chú
}

export interface Subject {
  id: string;
  name: string;
  gradeId: string;
  image?: string;
}

export interface Topic {
  id: string;
  name: string;
  subjectId: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string; // HTML or Markdown
  topicId: string;
  order: number;
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE', // Trắc nghiệm (có thể 1 hoặc nhiều đáp án đúng)
  TRUE_FALSE = 'TRUE_FALSE', // Đúng sai
  SHORT_ANSWER = 'SHORT_ANSWER', // Trả lời ngắn
  FILL_IN_THE_BLANK = 'FILL_IN_THE_BLANK', // Điền khuyết
}

export enum QuestionLevel {
  RECOGNITION = 'RECOGNITION', // Nhận biết
  UNDERSTANDING = 'UNDERSTANDING', // Thông hiểu
  APPLICATION = 'APPLICATION', // Vận dụng
  HIGH_APPLICATION = 'HIGH_APPLICATION', // Vận dụng cao
}

export interface Answer {
  id: string;
  content: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  content: string;
  type: QuestionType;
  level: QuestionLevel;
  lessonId: string;
  image?: string; // URL hoặc Base64 của hình ảnh đính kèm
  answers: Answer[];
  stats?: {
    used: number;    // Number of times included in a submission
    correct: number; // Number of times answered correctly
  };
}

// Exam Interfaces
export interface ExamStructure {
  lessonIds: string[];
  levelCounts: Record<QuestionLevel, number>;
  totalQuestions: number;
}

export interface ExamVariant {
  code: string; // e.g., "101", "102"
  questionIds: string[]; // List of question IDs in order
}

export interface Exam {
  id: string;
  title: string;
  gradeId: string;
  subjectId: string;
  topicId?: string; // Optional, maybe exam covers multiple topics
  duration: number; // minutes
  structure: ExamStructure;
  variants: ExamVariant[];
  createdAt: string;
  status: 'DRAFT' | 'PUBLISHED';
}

export interface Assignment {
  id: string;
  examId: string;
  classId: string;
  code: string; // 8 char unique code
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  startTime: string; // ISO Date
  endTime: string; // ISO Date
  duration: number; // minutes
  attempts: number; // Number of allowed attempts
  settings: {
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    showResult: boolean;
  };
  createdAt: string;
}

export interface SubmissionAnswer {
  questionId: string;
  answerId?: string; // For multiple choice
  textAnswer?: string; // For short answer
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  startTime: string;
  endTime: string | null;
  answers: SubmissionAnswer[];
  score: number;
  totalQuestions: number;
  passed: boolean; // Score >= 70%
  violationCount: number; // Number of times user left the tab
}

export interface SystemLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}
