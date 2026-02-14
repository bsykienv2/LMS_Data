
/**
 * ============================================================================
 * AUTHENTICATION SERVICE
 * ============================================================================
 */

/**
 * Utility: Hash Password (SHA-256)
 */
function hashPassword(rawPassword) {
  if (!rawPassword) return '';
  const rawBits = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawPassword);
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
  const user = result.data.find(u => u.username == username);

  if (!user) throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');

  // 2. Validate Password (Hash Compare)
  const inputHash = hashPassword(password);
  
  // Backwards compatibility check: 
  // If stored password is short (e.g. "1"), it's plain text. Compare directly.
  // If stored password is long (64 chars), it's hash. Compare hash.
  let isValid = false;
  if (user.password.length < 50) {
     if (user.password === password) isValid = true;
  } else {
     if (user.password === inputHash) isValid = true;
  }

  if (!isValid) throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
  
  if (String(user.isActive) === 'false') throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ Admin.');

  // 3. Generate Token
  const token = `${user.id}_${new Date().getTime()}_${Math.floor(Math.random() * 1000)}`;

  // 4. Lưu token
  try {
    updateRecord('USERS', user.id, { token: token });
  } catch (e) {
    Logger.log('Lỗi lưu token: ' + e.message);
  }

  // 5. Trả về kết quả (Không trả về password hash)
  // Clone user to remove password
  const safeUser = JSON.parse(JSON.stringify(user));
  delete safeUser.password;

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

  const result = getAll('USERS');
  const user = result.data.find(u => String(u.token) === String(token));

  if (!user) throw new Error('Unauthorized: Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  if (String(user.isActive) === 'false') throw new Error('Unauthorized: Tài khoản đã bị khóa.');

  return user;
}

function requireRole(role, action) {
  if (role === 'ADMIN') return true;

  if (role === 'STUDENT') {
    switch (action) {
      case 'read':   return true;
      case 'update': return true;
      case 'create': return false; // Except special routes in Code.gs
      case 'delete': return false;
      default: return false;
    }
  }

  return false;
}
