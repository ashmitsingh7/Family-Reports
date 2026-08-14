/**
 * Reminders.gs
 * A person has at most one PENDING reminder at any time. Uploading a new
 * report always cancels the old pending reminder and creates a fresh one,
 * calculated in calendar months (not a fixed day count) from the test date.
 */

var REMINDER_STATUS_PENDING = 'PENDING';
var REMINDER_STATUS_SENT = 'SENT';
var REMINDER_STATUS_CANCELLED = 'CANCELLED';
var REMINDER_STATUS_FAILED = 'FAILED';

function getRemindersSheet_() {
  return getSheet_('Reminders');
}

/**
 * Adds `months` calendar months to `date`, clamping to the last valid
 * day of the target month (so 31 Jan + 1 month -> 28/29 Feb, not 3 Mar).
 */
function addCalendarMonths_(date, months) {
  var year = date.getFullYear();
  var month = date.getMonth();
  var day = date.getDate();

  var targetMonthIndex = month + months;
  var targetYear = year + Math.floor(targetMonthIndex / 12);
  var targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  var lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  var targetDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(targetYear, targetMonth, targetDay, date.getHours(), date.getMinutes(), date.getSeconds());
}

function getActiveReminderForPerson_(personId) {
  var sheet = getRemindersSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    var obj = rowToObject_(headers, data[i]);
    if (String(obj.person_id) === String(personId) && obj.status === REMINDER_STATUS_PENDING) {
      return obj;
    }
  }
  return null;
}

/**
 * Cancels any existing pending reminder for this person and creates a new
 * one anchored to the given report's test date. Called from within the
 * upload-report lock, so it does not take its own lock.
 */
function rescheduleReminderForPerson_(personId, reportId, testDate) {
  var sheet = getRemindersSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var statusCol = headers.indexOf('status') + 1;

  for (var i = 1; i < data.length; i++) {
    var obj = rowToObject_(headers, data[i]);
    if (String(obj.person_id) === String(personId) && obj.status === REMINDER_STATUS_PENDING) {
      sheet.getRange(i + 1, statusCol).setValue(REMINDER_STATUS_CANCELLED);
    }
  }

  var person = getPersonRecord_(personId);
  var remindersEnabled = person.reminders_enabled === true || person.reminders_enabled === 'TRUE';
  if (!remindersEnabled) return null;

  var months = Number(person.reminder_interval_months) || getDefaultReminderMonths_();
  var scheduledFor = addCalendarMonths_(new Date(testDate), months);

  var id = nextId_(sheet);
  sheet.appendRow([id, personId, reportId, scheduledFor, '', REMINDER_STATUS_PENDING]);
  return { id: id, scheduledFor: scheduledFor };
}

/**
 * Daily trigger entry point. Idempotent and lock-protected: a reminder
 * marked SENT is never re-sent, and concurrent runs can't double-send.
 */
function checkReminders() {
  var lock = LockService.getScriptLock();
  var gotLock = lock.tryLock(60000);
  if (!gotLock) {
    Logger.log('checkReminders: could not acquire lock, another run is in progress.');
    return;
  }

  try {
    var sheet = getRemindersSheet_();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = headers.indexOf('id');
    var personCol = headers.indexOf('person_id');
    var scheduledCol = headers.indexOf('scheduled_for');
    var sentCol = headers.indexOf('sent_at');
    var statusCol = headers.indexOf('status');

    var today = new Date();
    today.setHours(23, 59, 59, 999); // treat "today" inclusively

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[statusCol] !== REMINDER_STATUS_PENDING) continue;

      var scheduledFor = new Date(row[scheduledCol]);
      if (isNaN(scheduledFor.getTime()) || scheduledFor > today) continue;

      var personId = row[personCol];
      var person = getPersonRecord_(personId);

      if (!person || person.enabled === false || person.enabled === 'FALSE') {
        sheet.getRange(i + 1, statusCol + 1).setValue(REMINDER_STATUS_CANCELLED);
        continue;
      }
      var remindersEnabled = person.reminders_enabled === true || person.reminders_enabled === 'TRUE';
      if (!remindersEnabled) {
        sheet.getRange(i + 1, statusCol + 1).setValue(REMINDER_STATUS_CANCELLED);
        continue;
      }

      try {
        sendReminderEmail_(person);
        sheet.getRange(i + 1, sentCol + 1).setValue(new Date());
        sheet.getRange(i + 1, statusCol + 1).setValue(REMINDER_STATUS_SENT);
      } catch (err) {
        Logger.log('checkReminders: failed to send for person ' + personId + ': ' + err);
        sheet.getRange(i + 1, statusCol + 1).setValue(REMINDER_STATUS_FAILED);
      }
    }
  } finally {
    lock.releaseLock();
  }
}
