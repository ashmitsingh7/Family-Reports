/**
 * DriveStorage.gs
 * Reports are opaque files. This module only stores/retrieves bytes -
 * it never inspects, OCRs, or extracts anything from them.
 * Files are private; there is no "anyone with the link" sharing anywhere.
 */

var ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function getReportsFolder_() {
  var id = getConfig_('REPORTS_FOLDER_ID');
  if (!id) throw new Error('Application is not initialized.');
  return DriveApp.getFolderById(id);
}

function getBackupsFolder_() {
  var id = getConfig_('BACKUPS_FOLDER_ID');
  if (!id) throw new Error('Application is not initialized.');
  return DriveApp.getFolderById(id);
}

function getPersonFolder_(personId) {
  var reportsFolder = getReportsFolder_();
  return getOrCreateChildFolder_(reportsFolder, 'Person_' + personId);
}

/**
 * Validates and saves an uploaded file. `fileData` is
 * {base64, mimeType, filename, sizeBytes} sent from the client.
 * Returns the new Drive file's id (kept private the whole time).
 */
function saveReportFile_(personId, fileData) {
  if (!fileData || !fileData.base64) throw new Error('No file was provided.');

  var mimeType = fileData.mimeType;
  if (ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error('Only PDF, JPG, or PNG files are allowed.');
  }

  var bytes = Utilities.base64Decode(fileData.base64);
  if (bytes.length === 0) throw new Error('The file appears to be empty.');
  if (bytes.length > getMaxUploadBytes_()) {
    throw new Error('That file is larger than the allowed upload size.');
  }

  var safeName = sanitizeFilename_(fileData.filename || 'report');
  var blob = Utilities.newBlob(bytes, mimeType, safeName);

  var folder = getPersonFolder_(personId);
  var file = folder.createFile(blob);
  // Explicitly private: only people with direct access (owner/domain via app) can open it.
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);

  return {
    driveFileId: file.getId(),
    filename: safeName,
    mimeType: mimeType,
    sizeBytes: bytes.length
  };
}

function sanitizeFilename_(name) {
  var cleaned = String(name).replace(/[^a-zA-Z0-9._\- ]/g, '').trim();
  if (!cleaned) cleaned = 'report';
  if (cleaned.length > 120) cleaned = cleaned.substring(0, 120);
  return cleaned;
}

/**
 * Returns the file's bytes as base64 for in-app viewing/downloading.
 * Callers MUST already have verified the requesting user is authorized
 * to see this particular report (see Reports.gs::getReportFile).
 */
function readReportFileAsBase64_(driveFileId) {
  var file = DriveApp.getFileById(driveFileId);
  var blob = file.getBlob();
  return {
    base64: Utilities.base64Encode(blob.getBytes()),
    mimeType: blob.getContentType(),
    filename: file.getName()
  };
}

function copyFileToBackup_(driveFileId, personId) {
  var file = DriveApp.getFileById(driveFileId);
  var backups = getBackupsFolder_();
  var personBackupFolder = getOrCreateChildFolder_(backups, 'Person_' + personId);
  var existing = personBackupFolder.getFilesByName(file.getName());
  if (existing.hasNext()) return existing.next().getId(); // already backed up, skip duplicate
  var copy = file.makeCopy(file.getName(), personBackupFolder);
  copy.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  return copy.getId();
}
