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

function sheetRows(spreadsheet, sheetName, headerRow) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  const headerIndex = Math.max(0, Number(headerRow || 1) - 1);
  if (values.length <= headerIndex + 1) return [];
  const headers = values[headerIndex].map(function (value) { return value.trim(); });
  return values.slice(headerIndex + 1).filter(function (row) {
    return row.some(function (value) { return String(value || '').trim() !== ''; });
  }).map(function (row) {
    const record = {};
    headers.forEach(function (header, index) { record[header] = String(row[index] || '').trim(); });
    return record;
  });
}

function upsertRow(sheet, headerRow, matchHeaders, data) {
  const headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const normalized = {};
  headers.forEach(function (header, index) { normalized[String(header).trim()] = index; });
  const dataRowCount = Math.max(0, sheet.getMaxRows() - headerRow);
  const displayedRows = dataRowCount ? sheet.getRange(headerRow + 1, 1, dataRowCount, headers.length).getDisplayValues() : [];
  let targetRow = 0;
  let firstEmptyRow = 0;
  displayedRows.forEach(function (values, offset) {
    if (!firstEmptyRow && values.every(function (value) { return String(value || '').trim() === ''; })) firstEmptyRow = headerRow + 1 + offset;
    const matches = matchHeaders.some(function (header) {
      const value = data[header];
      const index = normalized[header];
      return value != null && String(value).trim() !== '' && index != null && String(values[index]).trim().toLowerCase() === String(value).trim().toLowerCase();
    });
    if (!targetRow && matches) targetRow = headerRow + 1 + offset;
  });
  targetRow = targetRow || firstEmptyRow;
  if (!targetRow) {
    sheet.insertRowAfter(sheet.getMaxRows());
    targetRow = sheet.getMaxRows();
  }
  const existing = targetRow ? sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0] : Array(headers.length).fill('');
  headers.forEach(function (header, index) {
    const key = String(header).trim();
    if (Object.prototype.hasOwnProperty.call(data, key)) existing[index] = data[key];
  });
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([existing]);
  return { saved: 1 };
}

function deleteMatchingRow(sheet, headerRow, matchHeaders, data) {
  const headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const dataRowCount = Math.max(0, sheet.getMaxRows() - headerRow);
  const rows = dataRowCount ? sheet.getRange(headerRow + 1, 1, dataRowCount, headers.length).getDisplayValues() : [];
  let deleted = 0;
  rows.forEach(function (values, offset) {
    const matches = matchHeaders.some(function (header) {
      const index = headers.indexOf(header);
      return index >= 0 && data[header] && String(values[index]).trim().toLowerCase() === String(data[header]).trim().toLowerCase();
    });
    if (matches) {
      sheet.getRange(headerRow + 1 + offset, 1, 1, headers.length).clearContent();
      deleted += 1;
    }
  });
  return { deleted: deleted };
}

function upsertStudent(spreadsheet, data) {
  return upsertRow(spreadsheet.getSheetByName('Students'), 2, ['Account ID', 'Email', 'NPM'], data);
}

function deleteStudent(spreadsheet, data) {
  return deleteMatchingRow(spreadsheet.getSheetByName('Students'), 2, ['Account ID', 'Email', 'NPM'], data);
}

function upsertPlan(spreadsheet, data) {
  return upsertRow(spreadsheet.getSheetByName('Module Plans'), 1, ['source_key'], data);
}

function deletePlan(spreadsheet, data) {
  return deleteMatchingRow(spreadsheet.getSheetByName('Module Plans'), 1, ['source_key'], data);
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

function attendanceValues(entry, existing) {
  existing = existing || [];
  return [
    entry.sourceKey,
    entry.npm == null ? existing[1] || '' : entry.npm,
    entry.fullName == null ? existing[2] || '' : entry.fullName,
    entry.track == null ? existing[3] || '' : entry.track,
    entry.moduleLabel == null ? existing[4] || '' : entry.moduleLabel,
    entry.weekNumber == null ? existing[5] || '' : entry.weekNumber,
    entry.attendedDate == null ? existing[6] || '' : entry.attendedDate,
    entry.attendedTime == null ? existing[7] || '' : entry.attendedTime,
    entry.qnaScore == null || entry.qnaScore === '' ? '' : entry.qnaScore,
    entry.attendanceStatus == null ? existing[9] || 'on_time' : entry.attendanceStatus,
    entry.isMakeup == null ? String(existing[10]).toLowerCase() === 'true' : Boolean(entry.isMakeup),
    entry.makeupForSourceKey == null ? existing[11] || '' : entry.makeupForSourceKey,
    entry.deadlineOverride == null ? existing[12] || '' : entry.deadlineOverride,
    entry.submissionOverride == null ? existing[13] || '' : entry.submissionOverride,
    entry.notes == null ? existing[14] || '' : entry.notes,
    entry.assistantCode == null ? existing[15] || '' : entry.assistantCode,
    entry.gradeReleased == null ? String(existing[16]).toLowerCase() === 'true' : Boolean(entry.gradeReleased)
  ];
}

function appendAttendance(spreadsheet, data) {
  const sheet = spreadsheet.getSheetByName('QnA Attendance');
  const rows = Array.isArray(data) ? data : [data];
  const sourceKeys = sheet.getMaxRows() > 1 ? sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).getDisplayValues() : [];
  const rowByKey = {};
  const emptyRows = [];
  sourceKeys.forEach(function (value, index) {
    const key = String(value[0] || '').trim();
    if (key) rowByKey[key] = index + 2;
    else emptyRows.push(index + 2);
  });
  rows.forEach(function (entry) {
    let targetRow = rowByKey[String(entry.sourceKey)];
    if (!targetRow) targetRow = emptyRows.shift();
    if (!targetRow) {
      sheet.insertRowAfter(sheet.getMaxRows());
      targetRow = sheet.getMaxRows();
    }
    const existing = targetRow ? sheet.getRange(targetRow, 1, 1, 17).getDisplayValues()[0] : [];
    const values = attendanceValues(entry, existing);
    sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
    rowByKey[String(entry.sourceKey)] = targetRow;
  });
  return { saved: rows.length };
}

function deleteAttendance(spreadsheet, sourceKeys) {
  const sheet = spreadsheet.getSheetByName('QnA Attendance');
  const wanted = {};
  (Array.isArray(sourceKeys) ? sourceKeys : [sourceKeys]).forEach(function (key) { wanted[String(key)] = true; });
  const rowCount = Math.max(0, sheet.getMaxRows() - 1);
  const keys = rowCount ? sheet.getRange(2, 1, rowCount, 1).getDisplayValues() : [];
  let deleted = 0;
  keys.forEach(function (value, index) {
    if (wanted[String(value[0])]) {
      sheet.getRange(index + 2, 1, 1, 17).clearContent();
      deleted += 1;
    }
  });
  return { deleted: deleted };
}

function syncWebsiteFromSheet(event) {
  const supported = ['Students', 'QnA Attendance', 'Module Plans'];
  if (event && event.range && supported.indexOf(event.range.getSheet().getName()) === -1) return;
  const config = getConfig();
  const syncSecret = config.websiteSyncSecret || config.secret;
  if (!config.websiteSyncUrl || !syncSecret) return;
  UrlFetchApp.fetch(config.websiteSyncUrl, {
    method: 'post',
    headers: { 'x-sync-secret': syncSecret },
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
  const moduleNumber = value.match(/(?:module|modul|m)?[-_]?([1-8])(?:$|\D)/);
  return moduleNumber ? 'Module ' + moduleNumber[1] : 'Other';
}

function reportFolder(config, data) {
  const root = DriveApp.getFolderById(config.folderId);
  const week = Math.max(1, Number(data.weekNumber) || 1);
  const track = String(data.track || 'RL').toUpperCase();
  if (track !== 'RL' && track !== 'IDP') throw new Error('Report submission is available only for RL and IDP');
  const trackFolder = childFolder(root, track);
  const weekFolder = childFolder(trackFolder, 'Week ' + String(week).padStart(2, '0'));
  return childFolder(weekFolder, moduleFolderName(data.reportGroup));
}

function ensureReportFolders(config) {
  const root = DriveApp.getFolderById(config.folderId);
  const modules = ['Module 2&3', 'Module 4&5', 'Module 6', 'Module 7', 'Module 8'];
  ['RL', 'IDP'].forEach(function (track) {
    const trackFolder = childFolder(root, track);
    for (let week = 1; week <= 5; week += 1) {
      const weekFolder = childFolder(trackFolder, 'Week ' + String(week).padStart(2, '0'));
      modules.forEach(function (moduleName) { childFolder(weekFolder, moduleName); });
    }
  });
  return { tracks: 2, weeksPerTrack: 5, modulesPerWeek: modules.length };
}

function uploadReport(config, spreadsheet, data) {
  if (data.mimeType !== 'application/pdf') throw new Error('Only PDF files are accepted');
  let blob;
  if (data.downloadUrl) {
    const response = UrlFetchApp.fetch(data.downloadUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('Could not retrieve the uploaded PDF');
    blob = response.getBlob().setName(data.driveFileName);
  } else {
    const bytes = Utilities.base64Decode(data.base64 || '');
    blob = Utilities.newBlob(bytes, data.mimeType, data.driveFileName);
  }
  if (blob.getBytes().length > 30 * 1024 * 1024) throw new Error('The PDF must be 30 MB or smaller');
  const folder = reportFolder(config, data);
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
    if (body.action === 'syncSnapshot') return jsonResponse({ data: {
      students: sheetRows(spreadsheet, 'Students', 2),
      attendance: sheetRows(spreadsheet, 'QnA Attendance', 1),
      plans: sheetRows(spreadsheet, 'Module Plans', 1)
    }});
    if (body.action === 'attendanceRows') return jsonResponse({ rows: sheetRows(spreadsheet, 'QnA Attendance', 1) });
    if (body.action === 'modulePlanRows') return jsonResponse({ rows: sheetRows(spreadsheet, 'Module Plans', 1) });
    if (body.action === 'studentRows') return jsonResponse({ rows: sheetRows(spreadsheet, 'Students', 2) });
    if (body.action === 'appendAttendance') return jsonResponse({ data: appendAttendance(spreadsheet, body.data) });
    if (body.action === 'deleteAttendance') return jsonResponse({ data: deleteAttendance(spreadsheet, body.data) });
    if (body.action === 'upsertStudent') return jsonResponse({ data: upsertStudent(spreadsheet, body.data) });
    if (body.action === 'deleteStudent') return jsonResponse({ data: deleteStudent(spreadsheet, body.data) });
    if (body.action === 'upsertPlan') return jsonResponse({ data: upsertPlan(spreadsheet, body.data) });
    if (body.action === 'deletePlan') return jsonResponse({ data: deletePlan(spreadsheet, body.data) });
    if (body.action === 'ensureReportFolders') return jsonResponse({ data: ensureReportFolders(config) });
    if (body.action === 'uploadReport') return jsonResponse({ data: uploadReport(config, spreadsheet, body.data) });
    return jsonResponse({ error: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}
