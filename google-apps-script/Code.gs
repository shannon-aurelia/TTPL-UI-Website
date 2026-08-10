function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getConfig() {
  const properties = PropertiesService.getScriptProperties();
  return {
    secret: properties.getProperty('TTPL_SECRET'),
    folderId: properties.getProperty('REPORT_FOLDER_ID'),
    spreadsheetId: properties.getProperty('CONTROL_SHEET_ID')
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

function uploadReport(config, spreadsheet, data) {
  if (data.mimeType !== 'application/pdf') throw new Error('Only PDF files are accepted');
  const bytes = Utilities.base64Decode(data.base64);
  if (bytes.length > 20 * 1024 * 1024) throw new Error('The PDF must be smaller than 20 MB');
  const folder = DriveApp.getFolderById(config.folderId);
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
    if (body.action === 'uploadReport') return jsonResponse({ data: uploadReport(config, spreadsheet, body.data) });
    return jsonResponse({ error: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}
