/**
 * People.gs
 * Family members. Deliberately just: name, email, reminder settings.
 * No relationship, age, gender, DOB, or medical fields - ever.
 */

function getPeopleSheet_() {
  return getSheet_('People');
}

function listPeople() {
  requireAuth_();
  var sheet = getPeopleSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var obj = rowToObject_(headers, data[i]);
    if (obj.enabled === false || obj.enabled === 'FALSE') continue;
    out.push(decoratePerson_(obj));
  }
  out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out;
}

/** Adds latest-report and next-reminder summary info used by the dashboard/people pages. */
function decoratePerson_(person) {
  var reports = getReportsForPerson_(person.id);
  var latest = reports.length ? reports[0] : null; // getReportsForPerson_ returns newest first
  var reminder = getActiveReminderForPerson_(person.id);
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    remindersEnabled: person.reminders_enabled === true || person.reminders_enabled === 'TRUE',
    reminderIntervalMonths: Number(person.reminder_interval_months) || getDefaultReminderMonths_(),
    reportCount: reports.length,
    lastTestDate: latest ? latest.test_date : null,
    nextReminderDate: reminder ? reminder.scheduled_for : null
  };
}

function getPerson(id) {
  requireAuth_();
  var person = getPersonRecord_(id);
  if (!person) throw new Error('Person not found.');
  return decoratePerson_(person);
}

function getPersonRecord_(id) {
  var sheet = getPeopleSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return rowToObject_(headers, data[i]);
  }
  return null;
}

function addPerson(input) {
  requireAdmin_();
  var name = String(input.name || '').trim();
  var email = String(input.email || '').trim().toLowerCase();
  if (!name) throw new Error('Enter a name.');
  if (!isValidEmail_(email)) throw new Error('Enter a valid email address.');

  var remindersEnabled = input.remindersEnabled !== false;
  var interval = parseInt(input.reminderIntervalMonths, 10) || getDefaultReminderMonths_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getPeopleSheet_();
    var id = nextId_(sheet);
    var now = new Date();
    sheet.appendRow([id, name, email, remindersEnabled, interval, true, now, now]);
    return id;
  } finally {
    lock.releaseLock();
  }
}

function updatePerson(input) {
  requireAdmin_();
  var id = input.id;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getPeopleSheet_();
    var rowIdx = findRowIndexById_(sheet, id);
    if (rowIdx === -1) throw new Error('Person not found.');

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var col = function (name) { return headers.indexOf(name) + 1; };

    if (input.name !== undefined) {
      var name = String(input.name).trim();
      if (!name) throw new Error('Enter a name.');
      sheet.getRange(rowIdx, col('name')).setValue(name);
    }
    if (input.email !== undefined) {
      var email = String(input.email).trim().toLowerCase();
      if (!isValidEmail_(email)) throw new Error('Enter a valid email address.');
      sheet.getRange(rowIdx, col('email')).setValue(email);
    }
    if (input.remindersEnabled !== undefined) {
      sheet.getRange(rowIdx, col('reminders_enabled')).setValue(!!input.remindersEnabled);
    }
    if (input.reminderIntervalMonths !== undefined) {
      var interval = parseInt(input.reminderIntervalMonths, 10) || getDefaultReminderMonths_();
      sheet.getRange(rowIdx, col('reminder_interval_months')).setValue(interval);
    }
    sheet.getRange(rowIdx, col('updated_at')).setValue(new Date());
  } finally {
    lock.releaseLock();
  }
  return getPerson(id);
}

function disablePerson(id) {
  requireAdmin_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getPeopleSheet_();
    var rowIdx = findRowIndexById_(sheet, id);
    if (rowIdx === -1) throw new Error('Person not found.');
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.getRange(rowIdx, headers.indexOf('enabled') + 1).setValue(false);
    sheet.getRange(rowIdx, headers.indexOf('updated_at') + 1).setValue(new Date());
  } finally {
    lock.releaseLock();
  }
  return true;
}
