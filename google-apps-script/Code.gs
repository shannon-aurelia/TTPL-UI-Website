function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getConfig() {
  const properties = PropertiesService.getScriptProperties();
  return {
    secret: properties.getProperty('TTPL_SECRET'),
    folderId: properties.getProperty('REPORT_FOLDER_ID'),
    spreadsheetId: properties.getProperty('CONTROL_SHEET_ID'),
    websiteSyncUrl: properties.getProperty('WEBSITE_SYNC_URL'),
    websiteSyncSecret: properties.getProperty('WEBSITE_SYNC_SECRET')
  };
}

function sheetRows(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (value) { return value.trim(); });
  return values.slice(1).filter(function (row) {
    return row.some(function (value) { return String(value).trim() !== ''; });
  }).map(function (row) {
    const record = {};
    headers.forEach(function (header, index) { record[header] = String(row[index] || '').trim(); });
    return record;
  });
}

function appendSubmission(spreadsheet, data, file) {
  const sheet = spreadsheet.getSheetByName('Submission Log');
  sheet.appendRow([
    data.submissionId,
    data.npm,
    data.fullName,
    data.email,
    data.track,
    data.reportGroup,
    data.weekNumber,
    data.labDate,
    data.deadlineAt,
    data.submittedAt,
    data.minutesLate,
    data.latePenalty,
    data.originalFileName,
    file.getName(),
    file.getUrl(),
    'uploaded'
  ]);
}

function appendAttendance(spreadsheet, data) {
  const sheet = spreadsheet.getSheetByName('QnA Attendance');
  const rows = Array.isArray(data) ? data : [data];
  const lastRow = sheet.getLastRow();
  const sourceKeys = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues() : [];
  const rowByKey = {};
  sourceKeys.forEach(function (value, index) { rowByKey[String(value[0])] = index + 2; });
  const newRows = [];
  rows.forEach(function (entry) {
    const values = [
      entry.sourceKey,
      entry.npm || '',
      entry.fullName,
      entry.track,
      entry.moduleLabel,
      entry.weekNumber,
      entry.attendedDate,
      entry.attendedTime,
      entry.qnaScore === '' ? '' : entry.qnaScore,
      entry.attendanceStatus || 'on_time',
      Boolean(entry.isMakeup),
      '',
      '',
      '',
      entry.notes || '',
      entry.assistantCode || '',
      false
    ];
    if (rowByKey[String(entry.sourceKey)]) {
      sheet.getRange(rowByKey[String(entry.sourceKey)], 1, 1, values.length).setValues([values]);
    } else {
      newRows.push(values);
    }
  });
  if (newRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  return { saved: rows.length };
}

function deleteAttendance(spreadsheet, sourceKeys) {
  const sheet = spreadsheet.getSheetByName('QnA Attendance');
  const wanted = {};
  (Array.isArray(sourceKeys) ? sourceKeys : [sourceKeys]).forEach(function (key) { wanted[String(key)] = true; });
  let deleted = 0;
  for (let row = sheet.getLastRow(); row >= 2; row -= 1) {
    if (wanted[String(sheet.getRange(row, 1).getDisplayValue())]) {
      sheet.deleteRow(row);
      deleted += 1;
    }
  }
  return { deleted: deleted };
}

function syncWebsiteFromSheet(event) {
  if (event && event.range && event.range.getSheet().getName() !== 'QnA Attendance' && event.range.getSheet().getName() !== 'Module Plans') return;
  const config = getConfig();
  if (!config.websiteSyncUrl || !config.websiteSyncSecret) return;
  UrlFetchApp.fetch(config.websiteSyncUrl, {
    method: 'post',
    headers: { 'x-sync-secret': config.websiteSyncSecret },
    muteHttpExceptions: true
  });
}

function installWebsiteSyncTrigger() {
  const config = getConfig();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncWebsiteFromSheet') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('syncWebsiteFromSheet').forSpreadsheet(config.spreadsheetId).onEdit().create();
}

function childFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function moduleFolderName(reportGroup) {
  const value = String(reportGroup || '').toLowerCase().replace(/\s/g, '');
  if (value.indexOf('2-3') !== -1 || value.indexOf('2&3') !== -1 || value.indexOf('23') !== -1) return 'Module 2&3';
  if (value.indexOf('4-5') !== -1 || value.indexOf('4&5') !== -1 || value.indexOf('45') !== -1) return 'Module 4&5';
  const moduleNumber = value.match(/(?:module|modul|m)?[-_]?([678])(?:$|\D)/);
  return moduleNumber ? 'Module ' + moduleNumber[1] : 'Other';
}

function reportFolder(config, data) {
  const root = DriveApp.getFolderById(config.folderId);
  const week = Math.max(1, Number(data.weekNumber) || 1);
  const weekFolder = childFolder(root, 'Week ' + String(week).padStart(2, '0'));
  const trackFolder = childFolder(weekFolder, String(data.track || 'RL').toUpperCase());
  return childFolder(trackFolder, moduleFolderName(data.reportGroup));
}

function uploadReport(config, spreadsheet, data) {
  if (data.mimeType !== 'application/pdf') throw new Error('Only PDF files are accepted');
  const bytes = Utilities.base64Decode(data.base64);
  if (bytes.length > 20 * 1024 * 1024) throw new Error('The PDF must be smaller than 20 MB');
  const folder = reportFolder(config, data);
  const blob = Utilities.newBlob(bytes, data.mimeType, data.driveFileName);
  const file = folder.createFile(blob);
  appendSubmission(spreadsheet, data, file);
  return { fileId: file.getId(), fileUrl: file.getUrl(), fileName: file.getName() };
}

function doPost(event) {
  try {
    const config = getConfig();
    const body = JSON.parse(event.postData.contents || '{}');
    if (!config.secret || body.secret !== config.secret) return jsonResponse({ error: 'Unauthorized' });
    const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
    if (body.action === 'attendanceRows') return jsonResponse({ rows: sheetRows(spreadsheet, 'QnA Attendance') });
    if (body.action === 'modulePlanRows') return jsonResponse({ rows: sheetRows(spreadsheet, 'Module Plans') });
    if (body.action === 'appendAttendance') return jsonResponse({ data: appendAttendance(spreadsheet, body.data) });
    if (body.action === 'deleteAttendance') return jsonResponse({ data: deleteAttendance(spreadsheet, body.data) });
    if (body.action === 'uploadReport') return jsonResponse({ data: uploadReport(config, spreadsheet, body.data) });
    return jsonResponse({ error: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}
