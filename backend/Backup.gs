/**
 * Backup.gs
 * Metadata export + a repeat-safe copy of report files into Backups/.
 * Never deletes or modifies originals.
 */

/** Returns the whole database (minus Users, for privacy) as plain JSON for export. */
function exportData() {
  requireAdmin_();
  var ss = getSpreadsheet_();
  var out = {};
  ['People', 'Reports', 'Reminders'].forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      rows.push(rowToObject_(headers, data[i]));
    }
    out[name] = rows;
  });
  out.exportedAt = new Date().toISOString();
  return out;
}

/**
 * Copies every report file into Backups/Person_<id>/. Safe to run repeatedly -
 * files already backed up (matched by name) are skipped, not duplicated.
 */
function backupAllReportFiles() {
  requireAdmin_();
  var sheet = getReportsSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var driveIdCol = headers.indexOf('drive_file_id');
  var personCol = headers.indexOf('person_id');

  var copied = 0;
  for (var i = 1; i < data.length; i++) {
    try {
      copyFileToBackup_(data[i][driveIdCol], data[i][personCol]);
      copied++;
    } catch (err) {
      Logger.log('backupAllReportFiles: skipped one file: ' + err);
    }
  }
  return { filesProcessed: copied };
}
