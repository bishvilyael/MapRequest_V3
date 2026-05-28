const SOURCE_SPREADSHEET_ID = '1UIAJhdKlmVHK9OELsJkYna9vllaWhDp_eYTv3g4FMPQ';
const SOURCE_SHEET_NAME = 'רשימה משולבת';
const LOCAL_SPREADSHEET_ID = '1KAXwu3vIxssREWIyLdM_tvmvDmeGZhETNvOGgO6PaZA';
const LOCAL_EMAILS_SHEET_NAME = 'מיילים מקומיים';
const REQUESTS_SHEET_NAME = 'בקשות מפה אישית';
const NOTIFY_EMAIL = 'jiluz11@gmail.com';
const MAIL_FROM_ALIAS = 'BishvilYael@gmail.com';
const DEV_REQUEST_LABEL = 'מפות אישיות/דימוי מבקשים - בקשות';
const MAIL_FROM_NAME = 'בשביל יעל - מפות אישיות';
const SCRIPT_VERSION = '2026-05-24-SINGLE-REQUEST-ACTION-CLIENT-LOG-V2-EMAIL-LOG';
const REQUESTS_LOG_SHEET_NAME = 'לוג בקשות מפה אישית';

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const badgeNo = normalizeBadgeNo(params.badgeNo);

    if (!badgeNo) {
      return jsonOutput({ ok: false, version: SCRIPT_VERSION, error: 'Missing badgeNo' });
    }

    const person = findPersonByBadgeNo_SWITCH(badgeNo);

    if (!person) {
      return jsonOutput({
        ok: false,
        version: SCRIPT_VERSION,
        badgeNo: badgeNo,
        found: false,
        person: null,
        requestStatusList: [],
        error: 'BadgeNo not found'
      });
    }

    if (!normalizeText(person.email)) {
      person.email = getLocalEmailByBadgeNo(badgeNo);
    }

    delete person.localEmail;

    return jsonOutput({
      ok: true,
      version: SCRIPT_VERSION,
      badgeNo: badgeNo,
      found: true,
      person: person,
      requestStatusList: getRequestStatusListByBadgeNo(badgeNo)
    });

  } catch (err) {
    return jsonOutput({ ok: false, version: SCRIPT_VERSION, error: String(err) });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const action = String(data.action || 'submitRequest').trim();

    if (action === 'updateEmail') return handleUpdateEmail(data);

    if (action === 'saveRequest' || action === 'submitRequest') {
      return saveClientRequestState(data);
    }

    if (action === 'deleteRequest') return deleteMapRequest(data);
    if (action === 'deleteAllRequests') return deleteAllMapRequests(data);

    return jsonOutput({ ok: false, version: SCRIPT_VERSION, error: 'Unknown action: ' + action });

  } catch (err) {
    return jsonOutput({ ok: false, version: SCRIPT_VERSION, error: String(err) });
  }
}

function handleUpdateEmail(data) {
  const badgeNo = normalizeBadgeNo(data.badgeNo);
  const email = normalizeText(data.email);
  const inputNameHe = normalizeText(data.nameHe || data.userName);

  if (!badgeNo || !email) {
    return jsonOutput({ ok: false, version: SCRIPT_VERSION, error: 'Missing badgeNo or email' });
  }

  const result = updatePersonEmail(badgeNo, email);

  const sheet = getRequestsSheet_();
  ensureRequestHeaders(sheet);

  const existing = findSingleRequestRowByBadgeNo_(sheet, badgeNo);
  let requestUpdated = false;
  let reqId = '';
  let userName = inputNameHe;
  let oldRequestEmail = '';
  let oldAction = '';
  let oldStatus = '';

  if (existing) {
    reqId = normalizeText(getCellValueByHeader_(sheet, existing.row, 'ReqId'));
    userName = userName || normalizeText(getCellValueByHeader_(sheet, existing.row, 'שם בעברית'));
    oldRequestEmail = normalizeText(getCellValueByHeader_(sheet, existing.row, 'Email'));
    oldAction = normalizeText(getCellValueByHeader_(sheet, existing.row, 'Action')) || '-';
    oldStatus = normalizeText(getCellValueByHeader_(sheet, existing.row, 'Status'));

    setCellByHeader(sheet, existing.row, 'Email', email);
    setCellByHeader(sheet, existing.row, 'reqUpdate', new Date());
    setCellByHeader(sheet, existing.row, 'ScriptVersion', SCRIPT_VERSION);
    requestUpdated = true;
  }

  appendRequestLog_({
    reqId: reqId,
    badgeNo: badgeNo,
    userName: userName,
    userAction: 'עדכון אימייל',
    oldAction: oldAction,
    oldStatus: oldStatus,
    newAction: oldAction,
    newStatus: oldStatus,
    oldPublish: '',
    newPublish: '',
    message: 'האימייל עודכן מ-' + (oldRequestEmail || result.oldEmail || '') + ' ל-' + email
  });

  SpreadsheetApp.flush();

  return jsonOutput({
    ok: result.updated,
    version: SCRIPT_VERSION,
    updated: result.updated,
    requestUpdated: requestUpdated,
    badgeNo: badgeNo,
    row: result.row,
    reqId: reqId,
    oldEmail: result.oldEmail,
    oldRequestEmail: oldRequestEmail,
    newEmail: result.newEmail,
    error: result.updated ? '' : 'BadgeNo not found'
  });
}

function findPersonByBadgeNo_SWITCH(badgeNo) {
  badgeNo = biNormalizeBadgeNo_(badgeNo);
  if (!badgeNo) return null;
  if (USE_BADGE_INDEX) return findPersonByBadgeNoFromIndex(badgeNo);
  return findPersonByBadgeNo(badgeNo);
}

function findPersonByBadgeNo(badgeNo) {
  const sourceSS = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  const sourceSheet = sourceSS.getSheetByName(SOURCE_SHEET_NAME);

  if (!sourceSheet) throw new Error('Sheet not found: ' + SOURCE_SHEET_NAME);

  const values = sourceSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const nameHe = normalizeText(values[i][0]);
    const rowBadgeNo = normalizeBadgeNo(values[i][1]);
    const sourceEmail = normalizeText(values[i][4]);

    if (rowBadgeNo === badgeNo) {
      const localEmail = getLocalEmailByBadgeNo(badgeNo);

      return {
        nameHe: nameHe,
        email: localEmail || sourceEmail,
        sourceEmail: sourceEmail,
        localEmail: localEmail,
        row: i + 1
      };
    }
  }

  return null;
}

function getLocalEmailByBadgeNo(badgeNo) {
  const ss = SpreadsheetApp.openById(LOCAL_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(LOCAL_EMAILS_SHEET_NAME);

  if (!sheet) return '';

  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (normalizeBadgeNo(values[i][0]) === badgeNo) {
      return normalizeText(values[i][1]);
    }
  }

  return '';
}

function updatePersonEmail(badgeNo, email) {
  const ss = SpreadsheetApp.openById(LOCAL_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(LOCAL_EMAILS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(LOCAL_EMAILS_SHEET_NAME);
    sheet.appendRow(['BadgeNo', 'Email', 'UpdatedAt']);
  }

  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (normalizeBadgeNo(values[i][0]) === badgeNo) {
      sheet.getRange(i + 1, 2).setValue(email);
      sheet.getRange(i + 1, 3).setValue(new Date());
      SpreadsheetApp.flush();

      return {
        updated: true,
        row: i + 1,
        oldEmail: normalizeText(values[i][1]),
        newEmail: email
      };
    }
  }

  sheet.appendRow([badgeNo, email, new Date()]);
  SpreadsheetApp.flush();

  return {
    updated: true,
    row: sheet.getLastRow(),
    oldEmail: '',
    newEmail: email
  };
}

function saveClientRequestState(data) {
  const badgeNo = normalizeBadgeNo(data.badgeNo);
  const nameHe = normalizeText(data.nameHe);
  const email = normalizeText(data.email);
  const publishAllowed = !!data.publishAllowed;
  const userAction = normalizeUserAction_(data.userAction || data.requestAction);
  const pointCount = toSafeNumber(data.pointCount);
  const childCount = toSafeNumber(data.childCount);

  if (!badgeNo || !nameHe || !email) {
    return jsonOutput({ ok: false, version: SCRIPT_VERSION, error: 'Missing required fields' });
  }

  if (!userAction) {
    return jsonOutput({ ok: false, version: SCRIPT_VERSION, error: 'Missing or invalid userAction' });
  }

  const sheet = getRequestsSheet_();
  ensureRequestHeaders(sheet);

  const now = new Date();
  const existing = findSingleRequestRowByBadgeNo_(sheet, badgeNo);

  if (existing) {
    const oldAction = normalizeText(getCellValueByHeader_(sheet, existing.row, 'Action')) || '-';
    const oldStatus = normalizeText(getCellValueByHeader_(sheet, existing.row, 'Status'));
    const oldPublish = normalizeText(getCellValueByHeader_(sheet, existing.row, 'PublishAllowed'));
    const reqId = normalizeText(getCellValueByHeader_(sheet, existing.row, 'ReqId'));

    setCellByHeader(sheet, existing.row, 'Action', userAction);
    setCellByHeader(sheet, existing.row, 'Status', 'בטיפול');
    setCellByHeader(sheet, existing.row, 'BadgeNo', badgeNo);
    setCellByHeader(sheet, existing.row, 'שם בעברית', nameHe);
    setCellByHeader(sheet, existing.row, 'Email', email);
    setCellByHeader(sheet, existing.row, 'PublishAllowed', publishAllowed ? 'כן' : 'לא');
    setCellByHeader(sheet, existing.row, 'PointCount', pointCount);
    setCellByHeader(sheet, existing.row, 'ChildCount', childCount);
    setCellByHeader(sheet, existing.row, 'reqUpdate', now);
    setCellByHeader(sheet, existing.row, 'reqComp', '');
    setCellByHeader(sheet, existing.row, 'ScriptVersion', SCRIPT_VERSION);

    appendRequestLog_({
      reqId: reqId,
      badgeNo: badgeNo,
      userName: nameHe,
      userAction: userAction,
      oldAction: oldAction,
      oldStatus: oldStatus,
      newAction: userAction,
      newStatus: 'בטיפול',
      oldPublish: oldPublish,
      newPublish: publishAllowed ? 'כן' : 'לא',
      message: buildUserActionMessage_(userAction)
    });

    SpreadsheetApp.flush();

    const notifyResult = sendAdminNotificationOnly(
      badgeNo, nameHe, email, publishAllowed, userAction, reqId
    );

    setCellByHeader(sheet, existing.row, 'NotifySent', notifyResult.sent ? 'כן' : 'לא');
    setCellByHeader(sheet, existing.row, 'NotifyError', notifyResult.error || '');
    SpreadsheetApp.flush();

    return jsonOutput({
      ok: true,
      version: SCRIPT_VERSION,
      saved: true,
      mode: 'update_existing_single_request',
      row: existing.row,
      reqId: reqId,
      actionValue: userAction,
      status: 'בטיפול',
      message: buildUserActionMessage_(userAction),
      notifySent: notifyResult.sent,
      notifyError: notifyResult.error || ''
    });
  }

  const headerMap = getHeaderMap(sheet);
  const reqId = getNextReqIdByHeader(sheet, headerMap);

  const rowObj = {
    'ReqId': reqId,
    'Action': userAction,
    'reqDate': now,
    'reqUpdate': now,
    'reqComp': '',
    'BadgeNo': badgeNo,
    'שם בעברית': nameHe,
    'Email': email,
    'PublishAllowed': publishAllowed ? 'כן' : 'לא',
    'PointCount': pointCount,
    'ChildCount': childCount,
    'Status': 'בטיפול',
    'MapUrl': '',
    'Notes': '',
    'ScriptVersion': SCRIPT_VERSION,
    'NotifySent': '',
    'NotifyError': ''
  };

  sheet.appendRow(buildRowByHeaders(sheet, rowObj));
  const savedRow = sheet.getLastRow();

  appendRequestLog_({
    reqId: reqId,
    badgeNo: badgeNo,
    userName: nameHe,
    userAction: userAction,
    oldAction: '',
    oldStatus: '',
    newAction: userAction,
    newStatus: 'בטיפול',
    oldPublish: '',
    newPublish: publishAllowed ? 'כן' : 'לא',
    message: buildUserActionMessage_(userAction)
  });

  SpreadsheetApp.flush();

  const notifyResult = sendAdminNotificationOnly(
    badgeNo, nameHe, email, publishAllowed, userAction, reqId
  );

  setCellByHeader(sheet, savedRow, 'NotifySent', notifyResult.sent ? 'כן' : 'לא');
  setCellByHeader(sheet, savedRow, 'NotifyError', notifyResult.error || '');
  SpreadsheetApp.flush();

  return jsonOutput({
    ok: true,
    version: SCRIPT_VERSION,
    saved: true,
    mode: 'create_single_request',
    row: savedRow,
    reqId: reqId,
    actionValue: userAction,
    status: 'בטיפול',
    message: buildUserActionMessage_(userAction),
    notifySent: notifyResult.sent,
    notifyError: notifyResult.error || ''
  });
}

function submitMapRequest(data) {
  data.userAction = data.userAction || data.requestAction || 'עדכון';
  return saveClientRequestState(data);
}

function deleteMapRequest(data) {
  data.userAction = 'מחיקה';
  return saveClientRequestState(data);
}

function deleteAllMapRequests(data) {
  data.userAction = 'מחיקה';
  return saveClientRequestState(data);
}

function normalizeUserAction_(value) {
  const text = normalizeText(value);
  const allowed = ['יצירה', 'עדכון', 'מחיקה', 'שחזור'];
  return allowed.indexOf(text) >= 0 ? text : '';
}

function buildUserActionMessage_(userAction) {
  switch (userAction) {
    case 'יצירה': return 'הבקשה נשלחה לטיפול';
    case 'עדכון': return 'עדכון הבקשה נשלח לטיפול';
    case 'מחיקה': return 'בקשת המחיקה נשלחה לטיפול';
    case 'שחזור': return 'בקשת השחזור נשלחה לטיפול';
    default: return 'הפעולה נשלחה לטיפול';
  }
}

function findSingleRequestRowByBadgeNo_(sheet, badgeNo) {
  const rows = findRequestRowsByBadgeNo_(sheet, badgeNo);
  if (!rows || rows.length === 0) return null;
  return rows[rows.length - 1];
}

function getRequestLogSheet_() {
  const ss = SpreadsheetApp.openById(LOCAL_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(REQUESTS_LOG_SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(REQUESTS_LOG_SHEET_NAME);

  ensureRequestLogHeaders_(sheet);
  return sheet;
}

function ensureRequestLogHeaders_(sheet) {
  const headers = [
    'ReqId',
    'DateTime',
    'BadgeNo',
    'UserName',
    'UserAction',
    'OldAction',
    'OldStatus',
    'NewAction',
    'NewStatus',
    'OldPublish',
    'NewPublish',
    'Message',
    'ScriptVersion'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return normalizeText(h); });

  headers.forEach(function (header) {
    if (existingHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      existingHeaders.push(header);
    }
  });
}

function appendRequestLog_(entry) {
  const sheet = getRequestLogSheet_();
  const rowObj = {
    'ReqId': entry.reqId || '',
    'DateTime': new Date(),
    'BadgeNo': entry.badgeNo || '',
    'UserName': entry.userName || '',
    'UserAction': entry.userAction || '',
    'OldAction': entry.oldAction || '',
    'OldStatus': entry.oldStatus || '',
    'NewAction': entry.newAction || '',
    'NewStatus': entry.newStatus || '',
    'OldPublish': entry.oldPublish || '',
    'NewPublish': entry.newPublish || '',
    'Message': entry.message || '',
    'ScriptVersion': SCRIPT_VERSION
  };
  sheet.appendRow(buildRowByHeaders(sheet, rowObj));
}

function getRequestsSheet_() {
  const ss = SpreadsheetApp.openById(LOCAL_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(REQUESTS_SHEET_NAME);

  if (!sheet) sheet = ss.insertSheet(REQUESTS_SHEET_NAME);

  return sheet;
}

function ensureRequestHeaders(sheet) {
  const requiredHeaders = [
    'ReqId',
    'Action',
    'reqDate',
    'reqUpdate',
    'reqComp',
    'BadgeNo',
    'שם בעברית',
    'Email',
    'PublishAllowed',
    'PointCount',
    'ChildCount',
    'Status',
    'MapUrl',
    'Notes',
    'ScriptVersion',
    'NotifySent',
    'NotifyError'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    return;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return normalizeText(h); });

  requiredHeaders.forEach(function (header) {
    if (existingHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      existingHeaders.push(header);
    }
  });
}

function getRequestStatusListByBadgeNo(badgeNo) {
  const sheet = getRequestsSheet_();
  ensureRequestHeaders(sheet);

  const item = findSingleRequestRowByBadgeNo_(sheet, badgeNo);
  if (!item) return [];

  return [requestRowToClientObject_(sheet, item.row)];
}

function requestRowToClientObject_(sheet, rowNumber) {
  return {
    reqId: normalizeText(getCellValueByHeader_(sheet, rowNumber, 'ReqId')),
    action: normalizeText(getCellValueByHeader_(sheet, rowNumber, 'Action')),
    status: normalizeText(getCellValueByHeader_(sheet, rowNumber, 'Status')),
    publishAllowed: normalizeText(getCellValueByHeader_(sheet, rowNumber, 'PublishAllowed')),
    pointCount: normalizeText(getCellValueByHeader_(sheet, rowNumber, 'PointCount')),
    childCount: normalizeText(getCellValueByHeader_(sheet, rowNumber, 'ChildCount')),
    reqDate: formatDateForClient_(getCellValueByHeader_(sheet, rowNumber, 'reqDate')),
    reqUpdate: formatDateForClient_(getCellValueByHeader_(sheet, rowNumber, 'reqUpdate')),
    reqComp: formatDateForClient_(getCellValueByHeader_(sheet, rowNumber, 'reqComp')),
    mapUrl: normalizeText(getCellValueByHeader_(sheet, rowNumber, 'MapUrl'))
  };
}

function findRequestRowsByBadgeNo_(sheet, badgeNo) {
  const headerMap = getHeaderMap(sheet);
  const badgeCol = headerMap['BadgeNo'];

  if (!badgeCol) throw new Error('Missing header: BadgeNo');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, badgeCol, lastRow - 1, 1).getValues();
  const result = [];

  values.forEach(function (row, index) {
    if (normalizeBadgeNo(row[0]) === badgeNo) {
      result.push({ row: index + 2 });
    }
  });

  return result;
}

function findRequestRowByReqId_(sheet, reqId, badgeNo) {
  const headerMap = getHeaderMap(sheet);
  const reqIdCol = headerMap['ReqId'];
  const badgeCol = headerMap['BadgeNo'];

  if (!reqIdCol) throw new Error('Missing header: ReqId');
  if (!badgeCol) throw new Error('Missing header: BadgeNo');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const width = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowReqId = normalizeText(values[i][reqIdCol - 1]);
    const rowBadgeNo = normalizeBadgeNo(values[i][badgeCol - 1]);

    if (rowReqId === String(reqId) && rowBadgeNo === badgeNo) {
      return { row: i + 2 };
    }
  }

  return null;
}

function getHeaderMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};

  headers.forEach(function (header, index) {
    const key = normalizeText(header);
    if (key) map[key] = index + 1;
  });

  return map;
}

function buildRowByHeaders(sheet, rowObj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  return headers.map(function (header) {
    const key = normalizeText(header);
    return Object.prototype.hasOwnProperty.call(rowObj, key) ? rowObj[key] : '';
  });
}

function setCellByHeader(sheet, rowNumber, headerName, value) {
  const headerMap = getHeaderMap(sheet);
  const col = headerMap[headerName];

  if (!col) throw new Error('Missing header: ' + headerName);

  sheet.getRange(rowNumber, col).setValue(value);
}

function getCellValueByHeader_(sheet, rowNumber, headerName) {
  const headerMap = getHeaderMap(sheet);
  const col = headerMap[headerName];

  if (!col) return '';

  return sheet.getRange(rowNumber, col).getValue();
}

function getNextReqIdByHeader(sheet, headerMap) {
  const reqIdCol = headerMap['ReqId'];

  if (!reqIdCol) throw new Error('Missing header: ReqId');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const values = sheet.getRange(2, reqIdCol, lastRow - 1, 1).getValues();
  let maxId = 0;

  values.forEach(function (row) {
    const n = Number(row[0]);
    if (!isNaN(n) && n > maxId) maxId = n;
  });

  return maxId + 1;
}

function formatDateForClient_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  return normalizeText(value);
}

function toSafeNumber(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function getNextReqId(sheet) {
  return getNextReqIdByHeader(sheet, getHeaderMap(sheet));
}

function sendAdminNotificationOnly(badgeNo, nameHe, email, publishAllowed, requestAction, reqId) {
  try {
    const actionText = requestAction || 'יצירה';
    const reqText = reqId ? 'בקשה: ' + reqId + '\n' : '';

    const subject = 'בקשה למפה אישית - ' + actionText + ' - יעל #' + badgeNo;

    const body =
      'התקבלה פעולה בבקשה למפה אישית.\n\n' +
      reqText +
      'פעולה: ' + actionText + '\n' +
      'מספר יעל: ' + badgeNo + '\n' +
      'שם: ' + nameHe + '\n' +
      'אימייל: ' + email + '\n' +
      'אישור הפצה באתר: ' + (publishAllowed ? 'כן' : 'לא') + '\n\n' +
      'גרסת סקריפט: ' + SCRIPT_VERSION;

    const label =
      GmailApp.getUserLabelByName(DEV_REQUEST_LABEL) ||
      GmailApp.createLabel(DEV_REQUEST_LABEL);

    const draft = GmailApp.createDraft(
      NOTIFY_EMAIL,
      subject,
      body,
      {
        from: MAIL_FROM_ALIAS,
        name: MAIL_FROM_NAME
      }
    );

    const thread = draft.getMessage().getThread();
    draft.send();

    Utilities.sleep(1000);

    thread.addLabel(label);
    thread.moveToArchive();

    return { sent: true, error: '' };

  } catch (err) {
    throw new Error('שליחת מייל נכשלה: ' + String(err));
  }
}

function normalizeBadgeNo(value) {
  if (value === null || value === undefined) return '';

  let s = String(value).trim();
  s = s.replace(/\.0$/, '');
  s = s.replace(/\s+/g, '');

  return s;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}