/**
 * Reports.gs
 * Reports are stored as opaque metadata + a private Drive file.
 * No OCR, no text extraction, no AI, no medical parsing - anywhere.
 */

function getReportsSheet_() {
  return getSheet_('Reports');
}

/** Newest first. */
function getReportsForPerson_(personId) {
  var sheet = getReportsSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var obj = rowToObject_(headers, data[i]);
    if (String(obj.person_id) === String(personId)) out.push(obj);
  }
  out.sort(function (a, b) { return new Date(b.test_date) - new Date(a.test_date); });
  return out;
}

function listReportsForPerson(personId) {
  requireAuth_();
  var person = getPersonRecord_(personId);
  if (!person) throw new Error('Person not found.');
  return getReportsForPerson_(personId).map(function (r) {
    return {
      id: r.id,
      personId: r.person_id,
      filename: r.filename,
      testDate: r.test_date,
      uploadedAt: r.uploaded_at,
      comment: r.comment,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes
    };
  });
}

function getReportRecord_(reportId) {
  var sheet = getReportsSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(reportId)) return rowToObject_(headers, data[i]);
  }
  return null;
}

function getReport(reportId) {
  requireAuth_();
  var r = getReportRecord_(reportId);
  if (!r) throw new Error('Report not found.');
  var person = getPersonRecord_(r.person_id);
  return {
    id: r.id,
    personId: r.person_id,
    personName: person ? person.name : '',
    filename: r.filename,
    testDate: r.test_date,
    uploadedAt: r.uploaded_at,
    comment: r.comment,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes
  };
}

/**
 * Returns the actual file bytes for viewing/downloading in-app.
 * Every access is re-authorized here server-side; the client never
 * supplies a Drive file id directly - only a report id it was shown.
 */
function getReportFile(reportId) {
  requireAuth_();
  var r = getReportRecord_(reportId);
  if (!r) throw new Error('Report not found.');
  return readReportFileAsBase64_(r.drive_file_id);
}

/**
 * input: { personId, testDate ('yyyy-MM-dd'), comment, file: {base64, mimeType, filename} }
 */
function uploadReport(input) {
  requireAuth_();
  var personId = input.personId;
  var person = getPersonRecord_(personId);
  if (!person) throw new Error('Select who this report is for.');

  var testDate = parseDateInput_(input.testDate);
  if (!testDate) throw new Error('Enter a valid test date.');

  var comment = sanitizeComment_(input.comment);

  var saved = saveReportFile_(personId, input.file);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getReportsSheet_();
    var id = nextId_(sheet);
    var now = new Date();
    sheet.appendRow([
      id, personId, saved.filename, saved.driveFileId,
      testDate, now, comment, saved.mimeType, saved.sizeBytes
    ]);

    // A new report always resets the reminder: cancel any pending one, create the next.
    rescheduleReminderForPerson_(personId, id, testDate);
  } finally {
    lock.releaseLock();
  }

  return getPerson(personId);
}

function deleteReport(reportId) {
  requireAdmin_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getReportsSheet_();
    var rowIdx = findRowIndexById_(sheet, reportId);
    if (rowIdx === -1) throw new Error('Report not found.');
    sheet.deleteRow(rowIdx);
    // Note: the underlying Drive file is intentionally left in place
    // (private, untouched) so a deleted-record mistake never loses the file.
  } finally {
    lock.releaseLock();
  }
  return true;
}

function sanitizeComment_(comment) {
  var c = String(comment || '').trim();
  if (c.length > 500) c = c.substring(0, 500);
  // Strip anything that looks like HTML/script content; comments are plain text only.
  return c.replace(/<[^>]*>/g, '');
}

function parseDateInput_(value) {
  if (!value) return null;
  var d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}
