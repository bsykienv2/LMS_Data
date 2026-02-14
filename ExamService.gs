
/**
 * ============================================================================
 * EXAM SERVICE
 * ============================================================================
 * Xử lý logic nghiệp vụ thi cử: Bắt đầu, Nộp bài, Chấm điểm
 */

/**
 * 1. START EXAM
 * Lấy đề thi, trộn câu hỏi (nếu có), và QUAN TRỌNG: Ẩn đáp án đúng
 */
function startExamSession(assignmentId, studentId) {
  // A. Validate Input
  if (!assignmentId) throw new Error("Thiếu Assignment ID");

  // B. Get Data
  const assignment = getById('ASSIGNMENTS', assignmentId).data;
  if (!assignment) throw new Error("Không tìm thấy bài thi");

  // C. Validate Status & Time
  const now = new Date();
  if (assignment.status !== 'OPEN') throw new Error("Đề thi chưa mở hoặc đã đóng");
  if (new Date(assignment.startTime) > now) throw new Error("Chưa đến giờ làm bài");
  
  // Cho phép trễ 1 chút (grace period) nhưng nếu quá endTime quá lâu thì chặn
  // Tuy nhiên, logic chặn start nên chặt chẽ
  if (new Date(assignment.endTime) < now) throw new Error("Đã hết giờ làm bài");

  // D. Check Attempts (Double Check)
  const allSubs = getAll('SUBMISSIONS').data;
  const studentSubs = allSubs.filter(s => s.assignmentId === assignmentId && s.studentId === studentId);
  if (studentSubs.length >= assignment.attempts) {
    throw new Error(`Bạn đã hết số lượt làm bài (${assignment.attempts} lượt)`);
  }

  // E. Get Exam & Questions
  const exam = getById('EXAMS', assignment.examId).data;
  if (!exam) throw new Error("Không tìm thấy đề gốc");

  // F. Variant Logic (Chọn mã đề)
  let questionIds = [];
  if (exam.variants && exam.variants.length > 0) {
    // Random variant
    const variant = exam.variants[Math.floor(Math.random() * exam.variants.length)];
    questionIds = variant.questionIds;
  } else {
    // Fallback
    const allQ = getAll('QUESTIONS').data;
    questionIds = allQ
      .filter(q => exam.structure.lessonIds.includes(q.lessonId))
      .slice(0, exam.structure.totalQuestions)
      .map(q => q.id);
  }

  // G. Fetch Question Details
  const allQuestions = getAll('QUESTIONS').data;
  let questions = questionIds.map(id => allQuestions.find(q => q.id === id)).filter(Boolean);

  // H. Shuffle Questions
  if (assignment.settings && assignment.settings.shuffleQuestions) {
    questions = shuffleArray(questions);
  }

  // I. SANITIZE DATA (SECURITY LAYER)
  const sanitizedQuestions = questions.map(q => {
    let answers = q.answers || [];
    
    if (assignment.settings && assignment.settings.shuffleAnswers) {
      answers = shuffleArray([...answers]);
    }

    const cleanAnswers = answers.map(a => ({
      id: a.id,
      content: a.content
      // KHÔNG gửi isCorrect
    }));

    return {
      id: q.id,
      content: q.content,
      type: q.type,
      level: q.level,
      image: q.image,
      answers: cleanAnswers
    };
  });

  return {
    assignment: assignment,
    examTitle: exam.title,
    duration: exam.duration,
    questions: sanitizedQuestions,
    startTimeServer: new Date().toISOString()
  };
}

/**
 * 2. SUBMIT EXAM
 * Nhận bài làm, so sánh với DB, tính điểm và lưu
 */
function submitExam(payload, user) {
  const { assignmentId, answers, violationCount, duration, clientIp } = payload;
  
  if (!assignmentId) throw new Error("Thiếu thông tin bài thi");

  // A. Load Root Data
  const assignment = getById('ASSIGNMENTS', assignmentId).data;
  if (!assignment) throw new Error("Bài thi không tồn tại");

  // --- SECURITY CHECK: PREVENT MULTIPLE SUBMISSIONS (RACE CONDITION) ---
  const allSubs = getAll('SUBMISSIONS').data;
  const existingSubs = allSubs.filter(s => s.assignmentId === assignmentId && s.studentId === user.id);
  
  if (existingSubs.length >= assignment.attempts) {
    throw new Error(`Từ chối nộp bài: Bạn đã sử dụng hết ${assignment.attempts} lượt thi.`);
  }

  // B. Load Questions
  const allQuestions = getAll('QUESTIONS').data;
  
  // C. Analyze Answers & Violation
  let scoreCount = 0;
  let totalQuestions = 0; // Sẽ tính dựa trên exam structure hoặc questions được submit (để an toàn nên lấy từ structure)
  
  const gradedDetails = [];
  const studentAnswersMap = {};
  
  if (Array.isArray(answers)) {
    answers.forEach(a => studentAnswersMap[a.questionId] = a);
  } else {
    Object.keys(answers).forEach(qId => studentAnswersMap[qId] = { questionId: qId, answerId: answers[qId] });
  }

  // Xác định danh sách câu hỏi gốc của đề để tính totalQuestions chính xác
  // Ở đây ta chấp nhận tính trên số câu hỏi được gửi lên, nhưng thực tế nên lưu Session.
  // Để đơn giản hóa cho prompt này, ta coi số câu hỏi học sinh nhận được = số câu hỏi nộp lên.
  const submittedQuestionIds = Object.keys(studentAnswersMap);
  
  // Lấy Exam Structure để biết tổng số câu hỏi chuẩn
  const exam = getById('EXAMS', assignment.examId).data;
  totalQuestions = exam ? exam.structure.totalQuestions : submittedQuestionIds.length;

  // --- VIOLATION LOGIC ---
  let finalViolationCount = violationCount || 0;
  let violationReasons = [];

  // 1. Check Time (Grace period 2 minutes)
  const now = new Date();
  const endTime = new Date(assignment.endTime);
  const GRACE_PERIOD_MS = 2 * 60 * 1000; 
  
  if (now.getTime() > (endTime.getTime() + GRACE_PERIOD_MS)) {
    finalViolationCount += 1;
    violationReasons.push("Nộp quá giờ");
  }

  // 2. Check Completeness
  if (submittedQuestionIds.length < totalQuestions) {
    // Chỉ tính là vi phạm nếu số câu làm quá ít (< 50%) hoặc tùy chính sách
    // Ở đây ta chỉ ghi nhận log, có thể cộng violation nếu muốn nghiêm ngặt
    violationReasons.push(`Làm thiếu câu (${submittedQuestionIds.length}/${totalQuestions})`);
  }

  // 3. Client Violations (Tab switch)
  if (violationCount > 0) {
    violationReasons.push(`Rời màn hình ${violationCount} lần`);
  }

  // D. Grading
  submittedQuestionIds.forEach(qId => {
    const dbQuestion = allQuestions.find(q => q.id === qId);
    if (!dbQuestion) return;

    const studentAns = studentAnswersMap[qId];
    let isCorrect = false;

    if (dbQuestion.type === 'MULTIPLE_CHOICE' || dbQuestion.type === 'TRUE_FALSE') {
      const correctAns = dbQuestion.answers.find(a => a.isCorrect);
      if (correctAns && String(correctAns.id) === String(studentAns.answerId)) {
        isCorrect = true;
      }
    } else if (dbQuestion.type === 'SHORT_ANSWER' || dbQuestion.type === 'FILL_IN_THE_BLANK') {
      const correctAns = dbQuestion.answers.find(a => a.isCorrect);
      if (correctAns) {
        const textDb = String(correctAns.content).trim().toLowerCase();
        const textSt = String(studentAns.textAnswer || '').trim().toLowerCase();
        if (textDb === textSt) isCorrect = true;
      }
    }

    if (isCorrect) scoreCount++;

    gradedDetails.push({
      questionId: qId,
      answerId: studentAns.answerId,
      textAnswer: studentAns.textAnswer,
      isCorrect: isCorrect
    });
  });

  // E. Calculate Score
  const finalScore = totalQuestions > 0 
    ? parseFloat(((scoreCount / totalQuestions) * 10).toFixed(2)) 
    : 0;
  
  const passed = finalScore >= 5.0;

  // F. Create Submission Record
  const submissionData = {
    id: Utilities.getUuid().slice(0, 8),
    assignmentId: assignmentId,
    studentId: user.id,
    score: finalScore,
    answers: gradedDetails,
    totalQuestions: totalQuestions,
    passed: passed,
    violationCount: finalViolationCount,
    violationDetails: violationReasons.join(', '), // New field mostly for internal check (stored in answers/JSON if schema strict)
    startTime: payload.startTime || new Date().toISOString(),
    endTime: new Date().toISOString(),
    clientIp: clientIp || 'Unknown', // Store IP if provided
    createdAt: new Date().toISOString()
  };

  createRecord('SUBMISSIONS', submissionData);

  return {
    submissionId: submissionData.id,
    score: finalScore,
    passed: passed,
    totalQuestions: totalQuestions,
    correctCount: scoreCount,
    violationWarnings: violationReasons
  };
}

/**
 * 3. GET RESULT
 * Lấy chi tiết kết quả bài thi
 */
function getExamResult(submissionId, user) {
  const submission = getById('SUBMISSIONS', submissionId).data;
  if (!submission) throw new Error("Không tìm thấy bài làm");

  if (user.role === 'STUDENT' && submission.studentId !== user.id) {
    throw new Error("Bạn không có quyền xem bài làm này");
  }

  const assignment = getById('ASSIGNMENTS', submission.assignmentId).data;
  const showResult = assignment.settings ? assignment.settings.showResult : false;

  if (user.role === 'STUDENT' && !showResult) {
    return {
      ...submission,
      answers: [],
      message: "Giáo viên đã tắt chế độ xem chi tiết đáp án."
    };
  }

  return submission;
}

// --- HELPERS ---
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
