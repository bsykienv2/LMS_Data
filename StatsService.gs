
/**
 * ============================================================================
 * STATISTICS SERVICE
 * ============================================================================
 * Cung cấp dữ liệu tổng hợp cho Dashboard.
 * Chiến lược tối ưu: Đọc dữ liệu Sheet 1 lần -> Tính toán in-memory.
 */

/**
 * 1. ADMIN DASHBOARD STATS
 */
function getAdminStats() {
  // 1. Fetch all required data in parallel (conceptually)
  const usersRaw = getAll('USERS').data;
  const examsRaw = getAll('EXAMS').data;
  const subsRaw = getAll('SUBMISSIONS').data;
  const classesRaw = getAll('CLASSES').data;

  // 2. Filter Students
  const students = usersRaw.filter(u => u.role === 'STUDENT');

  // 3. Calculate Global Stats
  const totalStudents = students.length;
  const totalExams = examsRaw.length;
  const totalSubmissions = subsRaw.length;

  let totalScore = 0;
  subsRaw.forEach(s => totalScore += (Number(s.score) || 0));
  
  const avgSystemScore = totalSubmissions > 0 
    ? parseFloat((totalScore / totalSubmissions).toFixed(2)) 
    : 0;

  // 4. Calculate Leaderboard (Top 5 Students by Average Score)
  // Map: StudentID -> { totalScore, count, name, classId }
  const studentStats = {};

  // Init stats for all students (to include those with 0 submissions)
  students.forEach(s => {
    studentStats[s.id] = {
      id: s.id,
      name: s.name,
      classId: s.classId,
      className: classesRaw.find(c => c.id === s.classId)?.name || 'N/A',
      totalScore: 0,
      count: 0,
      avg: 0
    };
  });

  // Aggregate scores
  subsRaw.forEach(sub => {
    if (studentStats[sub.studentId]) {
      studentStats[sub.studentId].totalScore += (Number(sub.score) || 0);
      studentStats[sub.studentId].count += 1;
    }
  });

  // Convert to Array & Calculate Avg
  const leaderboard = Object.values(studentStats)
    .map(s => ({
      ...s,
      avg: s.count > 0 ? parseFloat((s.totalScore / s.count).toFixed(2)) : 0
    }))
    .filter(s => s.count > 0) // Only rank students who have taken exams
    .sort((a, b) => b.avg - a.avg) // Sort Descending
    .slice(0, 5); // Take Top 5

  // 5. Recent Activity (Last 5 submissions)
  // Assuming submissions are appended, the last rows are the newest.
  // We reverse to show newest first.
  const recentActivity = [...subsRaw].reverse().slice(0, 5).map(sub => {
    const st = usersRaw.find(u => u.id === sub.studentId);
    const assignment = getById('ASSIGNMENTS', sub.assignmentId).data; // Small optimization trade-off here
    const exam = assignment ? getById('EXAMS', assignment.examId).data : null;
    
    return {
      id: sub.id,
      studentName: st ? st.name : 'Unknown',
      examTitle: exam ? exam.title : 'Unknown',
      score: sub.score,
      submittedAt: sub.endTime
    };
  });

  return {
    overview: {
      totalStudents,
      totalExams,
      totalSubmissions,
      avgSystemScore
    },
    leaderboard,
    recentActivity
  };
}

/**
 * 2. STUDENT DASHBOARD STATS
 */
function getStudentStats(studentId) {
  // 1. Fetch Data
  const user = getById('USERS', studentId).data;
  if (!user || user.role !== 'STUDENT') throw new Error("Invalid Student ID");

  const allSubs = getAll('SUBMISSIONS').data;
  const allUsers = getAll('USERS').data;

  // 2. Filter My Submissions
  const mySubs = allSubs.filter(s => s.studentId === studentId);
  const myTotalScore = mySubs.reduce((acc, s) => acc + (Number(s.score) || 0), 0);
  const myCount = mySubs.length;
  const myAvg = myCount > 0 ? parseFloat((myTotalScore / myCount).toFixed(2)) : 0;

  // 3. Calculate Rank in Class
  const myClassId = user.classId;
  const classmates = allUsers.filter(u => u.classId === myClassId && u.role === 'STUDENT');
  
  // Aggregate Classmate Scores
  const classStats = classmates.map(mate => {
    const mateSubs = allSubs.filter(s => s.studentId === mate.id);
    const total = mateSubs.reduce((acc, s) => acc + (Number(s.score) || 0), 0);
    const count = mateSubs.length;
    return {
      id: mate.id,
      avg: count > 0 ? total / count : 0
    };
  });

  // Sort Descending
  classStats.sort((a, b) => b.avg - a.avg);

  // Find My Rank
  const myRankIndex = classStats.findIndex(s => s.id === studentId);
  const rank = myRankIndex !== -1 ? myRankIndex + 1 : 0;

  return {
    studentId,
    examsTaken: myCount,
    avgScore: myAvg,
    rank: rank,
    totalClassmates: classmates.length
  };
}
