
/**
 * ============================================================================
 * AUTHENTICATION SERVICE (FIXED TYPE CHECKING)
 * ============================================================================
 */

/**
 * Utility: Hash Password (SHA-256)
 */
function hashPassword(rawPassword) {
  if (!rawPassword) return '';
  const rawBits = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(rawPassword));
  let txtHash = '';
  for (let i = 0; i < rawBits.length; i++) {
    let hashVal = rawBits[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

/**
 * Xử lý đăng nhập: Xác thực và tạo token
 */
function login(username, password) {
  if (!username || !password) throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu');

  // 1. Tìm user trong DB
  const result = getAll('USERS');
  // Ép kiểu String cho username khi so sánh để an toàn
  const user = result.data.find(u => String(u.username) === String(username));

  if (!user) throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');

  // *** FIX CRITICAL: Ép kiểu mật khẩu từ DB sang String ***
  // Google Sheet trả về number '1' cho mật khẩu '1', khiến lệnh .length bị lỗi
  const dbPass = String(user.password);
  const inputPass = String(password);
  
  const inputHash = hashPassword(inputPass);
  let isValid = false;
  
  // 2. Validate Password
  // Case A: Mật khẩu cũ (Plain text) - Độ dài hash SHA256 luôn là 64 ký tự
  if (dbPass.length < 50) {
     if (dbPass === inputPass) isValid = true;
  } 
  // Case B: Mật khẩu đã mã hóa (Hashed)
  else {
     if (dbPass === inputHash) isValid = true;
  }

  if (!isValid) throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
  
  if (String(user.isActive) === 'false') throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ Admin.');

  // 3. Generate Token
  const token = `${user.id}_${new Date().getTime()}_${Math.floor(Math.random() * 1000)}`;

  // 4. Lưu token vào Sheet
  try {
    updateRecord('USERS', user.id, { token: token });
  } catch (e) {
    Logger.log('Lỗi lưu token vào Sheet: ' + e.message);
  }

  // Clone user to remove password
  const safeUser = JSON.parse(JSON.stringify(user));
  delete safeUser.password;
  safeUser.token = token;

  // 5. Cache Token
  try {
    const cache = CacheService.getScriptCache();
    cache.put(`AUTH_${token}`, JSON.stringify(safeUser), 21600);
  } catch (e) {
    console.error("Cache Error: " + e.message);
  }

  return {
    token: token,
    role: user.role,
    user: safeUser
  };
}

/**
 * Middleware: Kiểm tra tính hợp lệ của token
 */
function checkAuth(token) {
  if (!token) throw new Error('Unauthorized: Vui lòng đăng nhập.');

  // 1. Check Cache
  try {
    const cache = CacheService.getScriptCache();
    const cachedUser = cache.get(`AUTH_${token}`);
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }
  } catch (e) {}

  // 2. Check Sheet (Fallback)
  const result = getAll('USERS');
  const user = result.data.find(u => String(u.token) === String(token));

  if (!user) throw new Error('Unauthorized: Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  if (String(user.isActive) === 'false') throw new Error('Unauthorized: Tài khoản đã bị khóa.');

  // Re-cache
  try {
    const safeUser = JSON.parse(JSON.stringify(user));
    delete safeUser.password;
    CacheService.getScriptCache().put(`AUTH_${token}`, JSON.stringify(safeUser), 21600);
  } catch (e) {}

  return user;
}

function requireRole(role, action) {
  if (role === 'ADMIN') return true;
  if (role === 'STUDENT') {
    switch (action) {
      case 'read':   return true;
      case 'update': return true;
      case 'create': return false; 
      case 'delete': return false;
      default: return false;
    }
  }
  return false;
}
