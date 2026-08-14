/**
 * Code.gs
 * Web app entry point + shared Sheets helpers + one-time initialization.
 */

var SHEET_SCHEMAS = {
  People: ['id', 'name', 'email', 'reminders_enabled', 'reminder_interval_months', 'enabled', 'created_at', 'updated_at'],
  Reports: ['id', 'person_id', 'filename', 'drive_file_id', 'test_date', 'uploaded_at', 'comment', 'mime_type', 'size_bytes'],
  Reminders: ['id', 'person_id', 'report_id', 'scheduled_for', 'sent_at', 'status'],
  Users: ['email', 'role', 'enabled', 'created_at']
};

function doGet(e) {
  var user = getCurrentUser_();
  var template = HtmlService.createTemplateFromFile('index');
  template.authorized = !!(user && user.enabled);
  return template.evaluate()
    .setTitle(getAppNameSafe_())
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAppNameSafe_() {
  try { return getAppName_(); } catch (err) { return 'Family'; }
}

/** Used by index.html to inline styles.html / app.html / components. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ---------------- Spreadsheet helpers ---------------- */

function getSpreadsheet_() {
  var id = getConfig_('SPREADSHEET_ID');
  if (!id) throw new Error('Application is not initialized. Run initializeApplication() first.');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  return sheet;
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
}

function nextId_(sheet) {
  var data = sheet.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < data.length; i++) {
    var v = parseInt(data[i][0], 10);
    if (!isNaN(v) && v > max) max = v;
  }
  return max + 1;
}

function findRowIndexById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

/* ---------------- Initialization ---------------- */

/**
 * Safe to run multiple times. Creates the spreadsheet, sheets, headers,
 * Drive folders, default config, and the daily reminder trigger if they
 * don't already exist. Run this once from the Apps Script editor,
 * signed in as the account that should own the data.
 */
function initializeApplication() {
  var props = PropertiesService.getScriptProperties();

  // 1) Spreadsheet
  var ssId = props.getProperty('SPREADSHEET_ID');
  var ss;
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(getAppNameSafe_() + ' Health Records Database');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  // 2) Sheets + headers
  for (var name in SHEET_SCHEMAS) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var headers = SHEET_SCHEMAS[name];
    var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var needsHeaders = existing.join('') === '';
    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  // Remove default "Sheet1" if it's empty and unused
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    var firstCell = defaultSheet.getRange(1, 1).getValue();
    if (!firstCell) ss.deleteSheet(defaultSheet);
  }

  // 3) Drive folders
  var rootId = props.getProperty('ROOT_DRIVE_FOLDER_ID');
  var rootFolder = rootId ? getFolderByIdSafe_(rootId) : null;
  if (!rootFolder) {
    rootFolder = DriveApp.createFolder(getAppNameSafe_() + ' Health Records');
    props.setProperty('ROOT_DRIVE_FOLDER_ID', rootFolder.getId());
  }

  var reportsFolder = getOrCreateChildFolder_(rootFolder, 'Reports');
  props.setProperty('REPORTS_FOLDER_ID', reportsFolder.getId());

  var backupsFolder = getOrCreateChildFolder_(rootFolder, 'Backups');
  props.setProperty('BACKUPS_FOLDER_ID', backupsFolder.getId());

  // 4) Default config values (only fill in blanks)
  var defaults = CONFIG_DEFAULTS;
  for (var key in defaults) {
    if (!props.getProperty(key) && defaults[key]) {
      props.setProperty(key, defaults[key]);
    }
  }

  // 5) Make sure the initializing account is an enabled admin
  var usersSheet = ss.getSheetByName('Users');
  var email = getActiveEmail_();
  if (email) {
    var data = usersSheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email) { found = true; break; }
    }
    if (!found) {
      usersSheet.appendRow([email, ROLE_ADMIN, true, new Date()]);
    }
  }

  // 6) Daily trigger for checkReminders, avoiding duplicates
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = triggers.some(function (t) {
    return t.getHandlerFunction() === 'checkReminders';
  });
  if (!hasTrigger) {
    ScriptApp.newTrigger('checkReminders')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .inTimezone(getTimezone_())
      .create();
  }

  return {
    spreadsheetUrl: ss.getUrl(),
    rootFolderUrl: rootFolder.getUrl(),
    adminEmail: email
  };
}

function getFolderByIdSafe_(id) {
  try { return DriveApp.getFolderById(id); } catch (e) { return null; }
}

function getOrCreateChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}
