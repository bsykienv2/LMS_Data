
/**
 * ============================================================================
 * DATABASE LAYER (GOOGLE SHEETS INTERFACE WITH CACHING)
 * ============================================================================
 */

// --- UTILITIES ---

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function parseCell(value) {
  if (typeof value === 'string') {
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
  }
  return value;
}

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

// --- CACHE HELPERS ---

function clearCache(sheetName) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(`DATA_${sheetName}`);
  } catch (e) {
    console.error("Cache clear failed: " + e.toString());
  }
}

// --- CRUD OPERATIONS ---

/**
 * GET ALL: Lấy dữ liệu (Ưu tiên Cache)
 */
function getAll(sheetName) {
  const cacheKey = `DATA_${sheetName}`;
  const cache = CacheService.getScriptCache();

  // 1. Try Cache
  try {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      // Dữ liệu cache phải được chia nhỏ nếu quá lớn, nhưng ở đây ta giả định dữ liệu < 100KB cho simple app
      // Nếu null string thì bỏ qua
      return { status: 'success', data: JSON.parse(cachedData) };
    }
  } catch (e) {
    // Cache miss or error, proceed to sheet
  }

  // 2. Read Sheet
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) {
    return { status: 'success', data: [] };
  }

  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0];
  const rows = data.slice(1);

  const result = rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      if (header) {
        obj[header] = parseCell(row[index]);
      }
    });
    return obj;
  });

  // 3. Save to Cache (TTL 10 minutes)
  try {
    const jsonStr = JSON.stringify(result);
    // Cache limit is 100KB. Check size roughly.
    if (jsonStr.length < 95000) {
      cache.put(cacheKey, jsonStr, 600); 
    }
  } catch (e) {
    console.warn("Data too large to cache: " + sheetName);
  }

  return { status: 'success', data: result };
}

/**
 * GET BY ID
 */
function getById(sheetName, id) {
  const result = getAll(sheetName); // Uses cached getAll
  const item = result.data.find(i => String(i.id) === String(id));
  
  if (!item) {
    // Không throw error ở đây để tránh crash logic nếu ID cũ
    return { status: 'error', message: 'Not found' };
  }
  
  return { status: 'success', data: item };
}

/**
 * CREATE
 */
function createRecord(sheetName, data) {
  const sheet = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();
  
  if (lastCol === 0) throw new Error(`Sheet ${sheetName} has no headers.`);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  if (!data.id) data.id = Utilities.getUuid().slice(0, 8);
  if (!data.createdAt) data.createdAt = new Date().toISOString();

  const rowToAdd = headers.map(header => {
    const value = data[header];
    return formatCell(value);
  });

  sheet.appendRow(rowToAdd);
  SpreadsheetApp.flush();
  
  // *** INVALIDATE CACHE ***
  clearCache(sheetName);

  return { status: 'success', data: data };
}

/**
 * UPDATE
 */
function updateRecord(sheetName, id, updates) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 1) throw new Error(`Record with ID ${id} not found.`);

  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();
  const headers = values[0];
  
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) throw new Error("Sheet does not have an 'id' column.");

  const rowIndex = values.findIndex(row => String(row[idColIndex]) === String(id));

  if (rowIndex === -1) {
    throw new Error(`Record with ID ${id} not found.`);
  }

  const currentRow = values[rowIndex];
  const newRow = headers.map((header, colIndex) => {
    if (updates.hasOwnProperty(header)) {
      return formatCell(updates[header]);
    }
    return currentRow[colIndex];
  });

  sheet.getRange(rowIndex + 1, 1, 1, lastCol).setValues([newRow]);
  SpreadsheetApp.flush();

  // *** INVALIDATE CACHE ***
  clearCache(sheetName);

  const resultObj = {};
  headers.forEach((h, i) => resultObj[h] = parseCell(newRow[i]));

  return { status: 'success', data: resultObj };
}

/**
 * DELETE
 */
function deleteRecord(sheetName, id) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');
  
  if (idColIndex === -1) throw new Error("Sheet does not have an 'id' column.");

  const rowIndex = values.findIndex(row => String(row[idColIndex]) === String(id));

  if (rowIndex === -1) {
     throw new Error(`Record with ID ${id} not found.`);
  }

  sheet.deleteRow(rowIndex + 1);
  SpreadsheetApp.flush();

  // *** INVALIDATE CACHE ***
  clearCache(sheetName);

  return { status: 'success', id: id };
}

// --- SYSTEM UTILITIES ---

function logAction(userId, userName, action, target, status, details) {
  try {
    const sheet = getSheet('LOGS');
    const timestamp = new Date().toISOString();
    const id = Utilities.getUuid().slice(0, 8);
    sheet.appendRow([id, userId, userName, action, target, status, details, timestamp]);
    // Logs don't need intense caching strategies
  } catch (e) {
    console.error("Logging failed: " + e.toString());
  }
}

function backupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const backupData = {};

  sheets.forEach(sheet => {
    const name = sheet.getName();
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
  
  if (dataString.length > 49000) {
    backupSheet.appendRow([backupId, timestamp, "Error: Data too large for cell storage"]);
    return { status: 'error', message: 'Data too large' };
  } else {
    backupSheet.appendRow([backupId, timestamp, dataString]);
    return { status: 'success', backupId: backupId, timestamp: timestamp };
  }
}
