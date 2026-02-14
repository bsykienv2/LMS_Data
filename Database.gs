
/**
 * ============================================================================
 * DATABASE LAYER (GOOGLE SHEETS INTERFACE)
 * ============================================================================
 * Handles low-level Sheet CRUD operations with dynamic column mapping.
 */

// --- UTILITIES ---

/**
 * Lấy hoặc tạo Sheet theo tên
 */
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Helper: Chuyển đổi giá trị Cell sang JSON nếu cần
 * (Dùng khi đọc từ Sheet ra API)
 */
function parseCell(value) {
  if (typeof value === 'string') {
    // Kiểm tra xem có phải JSON array/object không
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value; // Giữ nguyên nếu không parse được
      }
    }
  }
  return value;
}

/**
 * Helper: Chuyển đổi dữ liệu API sang giá trị Cell
 * (Dùng khi ghi vào Sheet)
 */
function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

// --- CRUD OPERATIONS ---

/**
 * GET ALL: Lấy toàn bộ dữ liệu từ Sheet
 */
function getAll(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) {
    return { status: 'success', data: [] };
  }

  // Lấy toàn bộ data một lần để tối ưu hiệu suất
  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0]; // Dòng 1 là Header
  const rows = data.slice(1); // Từ dòng 2 là Data

  const result = rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      // Dynamic Mapping: Header -> Object Key
      if (header) {
        obj[header] = parseCell(row[index]);
      }
    });
    return obj;
  });

  return { status: 'success', data: result };
}

/**
 * GET BY ID: Lấy 1 dòng cụ thể
 */
function getById(sheetName, id) {
  // Vì Apps Script không có Indexing, ta dùng getAll để tìm (với data nhỏ < 10k dòng vẫn nhanh)
  // Nếu data lớn, cần caching hoặc thuật toán tìm kiếm binary (nếu sort).
  const result = getAll(sheetName);
  const item = result.data.find(i => String(i.id) === String(id));
  
  if (!item) {
    throw new Error(`Record with ID ${id} not found in ${sheetName}`);
  }
  
  return { status: 'success', data: item };
}

/**
 * CREATE: Thêm dòng mới
 */
function createRecord(sheetName, data) {
  const sheet = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();
  
  // 1. Đọc Header để biết thứ tự cột
  if (lastCol === 0) throw new Error(`Sheet ${sheetName} has no headers.`);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // 2. Tự động sinh ID và Timestamp nếu thiếu
  if (!data.id) data.id = Utilities.getUuid().slice(0, 8);
  if (!data.createdAt) data.createdAt = new Date().toISOString();

  // 3. Map data vào đúng thứ tự cột của Header
  const rowToAdd = headers.map(header => {
    const value = data[header];
    return formatCell(value);
  });

  // 4. Ghi vào Sheet
  sheet.appendRow(rowToAdd);

  return { status: 'success', data: data };
}

/**
 * UPDATE: Cập nhật dòng theo ID
 */
function updateRecord(sheetName, id, updates) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 1) throw new Error(`Record with ID ${id} not found (Sheet empty).`);

  // 1. Lấy toàn bộ data (bao gồm header)
  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();
  const headers = values[0];
  
  // 2. Tìm index của cột 'id'
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) throw new Error("Sheet does not have an 'id' column.");

  // 3. Tìm dòng cần sửa
  // Lưu ý: values bao gồm header ở index 0, nên row thực tế = rowIndex + 1
  const rowIndex = values.findIndex(row => String(row[idColIndex]) === String(id));

  if (rowIndex === -1) {
    throw new Error(`Record with ID ${id} not found in ${sheetName}`);
  }

  // 4. Merge dữ liệu cũ và mới
  const currentRow = values[rowIndex];
  const newRow = headers.map((header, colIndex) => {
    // Nếu field có trong updates -> lấy mới, ngược lại giữ cũ
    if (updates.hasOwnProperty(header)) {
      return formatCell(updates[header]);
    }
    return currentRow[colIndex];
  });

  // 5. Ghi đè lại dòng đó (rowIndex + 1 vì row Sheet bắt đầu từ 1)
  sheet.getRange(rowIndex + 1, 1, 1, lastCol).setValues([newRow]);

  // 6. Trả về object đã update đầy đủ (để frontend cập nhật state)
  const resultObj = {};
  headers.forEach((h, i) => resultObj[h] = parseCell(newRow[i]));

  return { status: 'success', data: resultObj };
}

/**
 * DELETE: Xóa dòng theo ID
 */
function deleteRecord(sheetName, id) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');
  
  if (idColIndex === -1) throw new Error("Sheet does not have an 'id' column.");

  // Tìm dòng (duyệt ngược để an toàn hơn nhưng ở đây findIndex cũng ok)
  const rowIndex = values.findIndex(row => String(row[idColIndex]) === String(id));

  if (rowIndex === -1) {
     throw new Error(`Record with ID ${id} not found.`);
  }

  // Xóa dòng. (rowIndex + 1)
  sheet.deleteRow(rowIndex + 1);

  return { status: 'success', id: id };
}

// --- SYSTEM UTILITIES ---

/**
 * Ghi log hệ thống
 */
function logAction(userId, userName, action, target, status, details) {
  try {
    const sheet = getSheet('LOGS');
    const timestamp = new Date().toISOString();
    const id = Utilities.getUuid().slice(0, 8);
    // Append row trực tiếp, không cần validate header quá kỹ cho log
    sheet.appendRow([id, userId, userName, action, target, status, details, timestamp]);
  } catch (e) {
    console.error("Logging failed: " + e.toString());
  }
}

/**
 * Backup toàn bộ Database ra JSON
 */
function backupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const backupData = {};

  sheets.forEach(sheet => {
    const name = sheet.getName();
    // Bỏ qua các bảng hệ thống để tránh phình dữ liệu backup
    if (name !== 'LOGS' && name !== 'BACKUP') {
      const result = getAll(name);
      if (result.status === 'success') {
        backupData[name] = result.data;
      }
    }
  });

  const backupSheet = getSheet('BACKUP');
  const backupId = Utilities.getUuid();
  const timestamp = new Date().toISOString();
  const dataString = JSON.stringify(backupData);
  
  // Lưu ý: Cell có giới hạn 50k ký tự. Nếu DB lớn cần chia chunk. 
  // Ở mức demo/app nhỏ thì ok.
  if (dataString.length > 49000) {
    backupSheet.appendRow([backupId, timestamp, "Error: Data too large for cell storage"]);
    return { status: 'error', message: 'Data too large' };
  } else {
    backupSheet.appendRow([backupId, timestamp, dataString]);
    return { status: 'success', backupId: backupId, timestamp: timestamp };
  }
}
