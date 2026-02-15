
/**
 * ============================================================================
 * SERVER-SIDE CONTROLLER (DYNAMIC ROUTER ARCHITECTURE)
 * ============================================================================
 */

// --- 1. CONFIGURATION & MAPPING ---

const APP_CONFIG = {
  LOCK_WAIT_MS: 30000,
  ADMIN_ROLE: 'ADMIN',
  // QUAN TRỌNG: Mật khẩu này phải khớp với VITE_API_SECRET ở Frontend
  API_SECRET: 'LMS_SECRET_KEY_SECURE_2024', 
  RATE_LIMIT: {
    WINDOW_S: 60,   // 1 minute
    MAX_REQ: 60     // 60 requests per minute
  }
};

const RESOURCES = {
  'users': 'USERS',
  'grades': 'GRADES',
  'classes': 'CLASSES',
  'subjects': 'SUBJECTS',
  'topics': 'TOPICS',
  'lessons': 'LESSONS',
  'questions': 'QUESTIONS',
  'exams': 'EXAMS',
  'assignments': 'ASSIGNMENTS',
  'submissions': 'SUBMISSIONS',
  'logs': 'LOGS',
  'config': 'CONFIG'
};

// --- 2. ENTRY POINTS ---

function doGet(e) { 
  if (!e) return HtmlService.createHtmlOutput("Server is running. Please use the Web App URL via API.");
  return handleRequest(e, 'GET'); 
}

function doPost(e) { 
  if (!e) return ContentService.createTextOutput(JSON.stringify({error: "Manual execution not supported"}));
  return handleRequest(e, 'POST'); 
}

// --- 3. MAIN REQUEST HANDLER ---

function handleRequest(e, httpMethod) {
  const lock = LockService.getScriptLock();
  
  try {
    if (!lock.tryLock(APP_CONFIG.LOCK_WAIT_MS)) {
      throw new Error('Server is busy. Please try again later.');
    }

    const params = parseParams(e);
    
    // --- A. SECURITY CHECK (API KEY & RATE LIMIT) ---
    validateSecurity(params);

    const { resource, action } = params;
    const token = params._sec?.token || params.token;

    // --- B. PUBLIC / SYSTEM ROUTES ---
    if (action === 'login') return authController(params.data);
    if (action === 'setup') {
      const result = setupController();
      return responseJSON(result, 'System initialized', true);
    }
    
    // *** CỨU HỘ: API Reset mật khẩu Admin về "1" ***
    // Gọi bằng cách mở tab mới: [SCRIPT_URL]?action=reset_admin&secret=LMS_SECRET_KEY_SECURE_2024
    if (action === 'reset_admin') {
       const users = getAll('USERS').data;
       const admin = users.find(u => u.username === 'admin');
       if (admin) {
         // Hash password "1"
         const newPass = hashPassword("1");
         updateRecord('USERS', admin.id, { password: newPass });
         return responseJSON({ success: true }, 'Admin password reset to "1"', true);
       } else {
         return responseJSON(null, 'Admin user not found', false);
       }
    }

    // --- C. AUTHENTICATION MIDDLEWARE ---
    const user = checkAuth(token); 

    // --- D. SPECIAL ADMIN ROUTES ---
    if (action === 'backup') {
      const result = backupController(user);
      return responseJSON(result, 'Backup generated', true);
    }

    // --- E. ANALYTICS & STATS ROUTES ---
    if (action === 'STATS_ADMIN') {
      if (user.role !== 'ADMIN') throw new Error("Forbidden");
      const stats = getAdminStats();
      return responseJSON(stats, 'Admin stats retrieved', true);
    }

    if (action === 'STATS_STUDENT') {
      const targetId = (user.role === 'ADMIN' && params.data && params.data.studentId) 
        ? params.data.studentId 
        : user.id;
      const stats = getStudentStats(targetId);
      return responseJSON(stats, 'Student stats retrieved', true);
    }

    // --- F. SPECIAL EXAM FLOW ROUTES ---
    const clientIp = params.data?.clientIp || 'Unknown';

    if (action === 'START_EXAM') {
      const result = startExamSession(params.data.assignmentId, user.id);
      logAction(user.id, user.name, 'START_EXAM', 'ASSIGNMENTS', 'SUCCESS', `Started Assignment: ${params.data.assignmentId}`);
      return responseJSON(result, 'Exam started', true);
    }
    
    if (action === 'SUBMIT_EXAM') {
      const result = submitExam(params.data, user);
      logAction(user.id, user.name, 'SUBMIT_EXAM', 'SUBMISSIONS', 'SUCCESS', `SubID: ${result.submissionId}`);
      return responseJSON(result, 'Exam submitted', true);
    }

    if (action === 'GET_RESULT') {
      const result = getExamResult(params.data.submissionId, user);
      return responseJSON(result, 'Result retrieved', true);
    }

    // --- G. DYNAMIC RESOURCE ROUTER (CRUD) ---
    const method = action ? action.toUpperCase() : (httpMethod === 'GET' ? 'GET' : 'POST');
    
    const payload = {
      id: params.id,
      data: params.data,
      role: user.role,
      user: user
    };

    const result = route(resource, method, payload);

    if (['POST', 'PUT', 'DELETE', 'CREATE', 'UPDATE'].includes(method)) {
      const targetId = params.id || (result && result.id) || 'N/A';
      logAction(user.id, user.name, method, resource || 'System', 'SUCCESS', `${method} executed on ID: ${targetId}`);
    }

    return responseJSON(result, 'Success', true);

  } catch (err) {
    Logger.log(`[ERROR] ${err.message}`);
    return responseJSON(null, err.message, false);
  } finally {
    lock.releaseLock();
  }
}

// --- 4. DYNAMIC ROUTER ---

function route(resource, method, payload) {
  const sheetName = RESOURCES[resource ? resource.toLowerCase() : ''];
  if (!sheetName) throw new Error(`Resource '${resource}' not found.`);

  const { id, data, role } = payload;

  const ACTIONS = {
    'GET': () => {
      checkPermission(role, 'read');
      return id ? getById(sheetName, id).data : getAll(sheetName).data;
    },
    'READ': () => ACTIONS['GET'](),

    'POST': () => {
      // PERMISSION CHECK
      if (sheetName === 'SUBMISSIONS' && role === 'STUDENT') { /* Allow */ } 
      else { checkPermission(role, 'create'); }

      // *** SECURITY INTERCEPTION: PASSWORD HASHING ***
      if (sheetName === 'USERS' && data.password) {
        data.password = hashPassword(data.password);
      }
      
      return createRecord(sheetName, data).data;
    },
    'CREATE': () => ACTIONS['POST'](),

    'PUT': () => {
      checkPermission(role, 'update');
      if (!id) throw new Error('Missing ID for update');

      // *** SECURITY INTERCEPTION: PASSWORD HASHING ***
      if (sheetName === 'USERS' && data.password) {
        if (data.password.length < 50) {
           data.password = hashPassword(data.password);
        }
      }

      return updateRecord(sheetName, id, data).data;
    },
    'UPDATE': () => ACTIONS['PUT'](),

    'DELETE': () => {
      checkPermission(role, 'delete');
      if (!id) throw new Error('Missing ID for delete');
      deleteRecord(sheetName, id);
      return { id };
    }
  };

  const actionFn = ACTIONS[method];
  if (!actionFn) throw new Error(`Method '${method}' not supported.`);

  return actionFn();
}

// --- 5. CONTROLLERS ---

function authController(data) {
  if (!data || !data.username || !data.password) throw new Error('Missing credentials');
  const result = login(data.username, data.password);
  logAction(result.user.id, result.user.name, 'LOGIN', 'System', 'SUCCESS', 'User logged in');
  return responseJSON(result, 'Login successful', true);
}

function setupController() {
  setupDatabase();
  return { status: 'initialized' };
}

function backupController(user) {
  if (user.role !== APP_CONFIG.ADMIN_ROLE) throw new Error('Forbidden');
  const backup = backupDatabase();
  logAction(user.id, user.name, 'BACKUP', 'System', 'SUCCESS', `Backup ID: ${backup.backupId}`);
  return backup;
}

// --- 6. HELPERS ---

function responseJSON(data, message, success) {
  return ContentService.createTextOutput(JSON.stringify({
    success: success,
    message: message,
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function checkPermission(role, action) {
  if (!requireRole(role, action)) throw new Error(`Forbidden: You do not have permission to ${action}.`);
}

function parseParams(e) {
  const params = e.parameter || {};
  if (e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      // Merge params, body, and flattened _sec if needed
      return { ...params, ...body };
    } catch (err) {}
  }
  return params;
}

// --- 7. SECURITY FUNCTIONS ---

function validateSecurity(params) {
  // 1. Check API Secret (Prevent random access)
  const clientSecret = params._sec?.secret || params.secret;
  if (clientSecret !== APP_CONFIG.API_SECRET) {
    throw new Error('Access Denied: Invalid API Secret');
  }

  // 2. Rate Limiting (Simple Implementation via CacheService)
  // Identify user by Token or fallback to a global bucket if unauthorized yet (login)
  const userId = params._sec?.token || params.token || 'ANONYMOUS_IP';
  const cache = CacheService.getScriptCache();
  const rateKey = `RATE_${userId}`;
  
  let count = cache.get(rateKey);
  count = count ? parseInt(count) : 0;
  
  if (count >= APP_CONFIG.RATE_LIMIT.MAX_REQ) {
    throw new Error('Rate Limit Exceeded. Please slow down.');
  }
  
  // Increment and set expiry
  cache.put(rateKey, String(count + 1), APP_CONFIG.RATE_LIMIT.WINDOW_S);
}

// --- 8. DATABASE SETUP ---
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schema = {
    'USERS': ['id', 'username', 'password', 'role', 'name', 'email', 'dob', 'classId', 'avatar', 'isActive', 'token', 'createdAt'],
    'GRADES': ['id', 'name', 'createdAt'],
    'CLASSES': ['id', 'name', 'gradeId', 'type', 'note', 'createdAt'],
    'SUBJECTS': ['id', 'name', 'gradeId', 'image', 'createdAt'],
    'TOPICS': ['id', 'name', 'subjectId', 'createdAt'],
    'LESSONS': ['id', 'title', 'content', 'topicId', 'order', 'createdAt'],
    'QUESTIONS': ['id', 'content', 'type', 'level', 'lessonId', 'answers', 'image', 'stats', 'createdAt'],
    'EXAMS': ['id', 'title', 'gradeId', 'subjectId', 'topicId', 'duration', 'structure', 'variants', 'status', 'createdAt'],
    'ASSIGNMENTS': ['id', 'examId', 'classId', 'code', 'status', 'startTime', 'endTime', 'duration', 'attempts', 'settings', 'createdAt'],
    'SUBMISSIONS': ['id', 'assignmentId', 'studentId', 'score', 'answers', 'totalQuestions', 'passed', 'violationCount', 'startTime', 'endTime', 'createdAt', 'clientIp', 'violationDetails'],
    'LOGS': ['id', 'userId', 'userName', 'action', 'target', 'status', 'details', 'timestamp'],
    'CONFIG': ['appName', 'schoolName'],
    'BACKUP': ['id', 'timestamp', 'data']
  };

  Object.keys(schema).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    const headers = schema[sheetName];
    if (sheet.getLastColumn() < headers.length) {
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
       sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#EFEFEF");
    }
  });
  
  // Seed Initial Admin with Hashed Password
  const userSheet = ss.getSheetByName('USERS');
  if (userSheet.getLastRow() < 2) {
    // Default pass: "1" -> Hash it
    const hashedPass = hashPassword("1"); 
    userSheet.appendRow(['admin', 'admin', hashedPass, 'ADMIN', 'Quản Trị Viên', 'admin@lms.vn', '', '', '', true, '', new Date().toISOString()]);
  }
}
