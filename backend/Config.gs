/**
 * Config.gs
 * All tunables live in Script Properties (PropertiesService), never hard-coded.
 * Run initializeApplication() once to populate sane defaults.
 */

var CONFIG_DEFAULTS = {
  APP_NAME: 'Family',
  TIMEZONE: 'Asia/Kolkata',
  DEFAULT_REMINDER_MONTHS: '3',
  MAX_UPLOAD_MB: '15',
  SPREADSHEET_ID: '',
  ROOT_DRIVE_FOLDER_ID: '',
  REPORTS_FOLDER_ID: '',
  BACKUPS_FOLDER_ID: ''
};

function getConfig_(key) {
  var props = PropertiesService.getScriptProperties();
  var val = props.getProperty(key);
  if (val === null || val === undefined || val === '') {
    return CONFIG_DEFAULTS[key] !== undefined ? CONFIG_DEFAULTS[key] : null;
  }
  return val;
}

function setConfig_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function getAllConfig_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var out = {};
  for (var k in CONFIG_DEFAULTS) {
    out[k] = props[k] !== undefined && props[k] !== '' ? props[k] : CONFIG_DEFAULTS[k];
  }
  return out;
}

function getAppName_() {
  return getConfig_('APP_NAME');
}

function getTimezone_() {
  return getConfig_('TIMEZONE');
}

function getDefaultReminderMonths_() {
  return parseInt(getConfig_('DEFAULT_REMINDER_MONTHS'), 10) || 3;
}

function getMaxUploadBytes_() {
  var mb = parseFloat(getConfig_('MAX_UPLOAD_MB')) || 15;
  return mb * 1024 * 1024;
}
