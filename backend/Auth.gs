/**
 * Auth.gs
 * Application-level authorization on top of Google account sign-in.
 * Every server entry point that touches data must call requireAuth_()
 * or requireAdmin_() first - the client is never trusted.
 */

var ROLE_ADMIN = 'ADMIN';
var ROLE_FAMILY = 'FAMILY';

function getActiveEmail_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    // Falls back to effective user in some execution contexts.
    email = Session.getEffectiveUser().getEmail();
  }
  return email ? email.toLowerCase() : '';
}

function getUsersSheet_() {
  return getSheet_('Users');
}

/**
 * Returns {email, role, enabled} for the current signed-in Google account,
 * or null if they are not on the authorized-user allowlist.
 */
function getCurrentUser_() {
  var email = getActiveEmail_();
  if (!email) return null;
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var emailIdx = headers.indexOf('email');
  var roleIdx = headers.indexOf('role');
  var enabledIdx = headers.indexOf('enabled');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][emailIdx]).toLowerCase() === email) {
      return {
        email: email,
        role: rows[i][roleIdx],
        enabled: rows[i][enabledIdx] === true || rows[i][enabledIdx] === 'TRUE'
      };
    }
  }
  return null;
}

/** Client-callable: who am I / can I get in. */
function whoAmI() {
  var user = getCurrentUser_();
  if (!user || !user.enabled) {
    return { authorized: false, email: getActiveEmail_() };
  }
  return {
    authorized: true,
    email: user.email,
    role: user.role,
    isAdmin: user.role === ROLE_ADMIN,
    appName: getAppName_()
  };
}

/** Throws if the caller is not an enabled authorized user. Returns the user record. */
function requireAuth_() {
  var user = getCurrentUser_();
  if (!user || !user.enabled) {
    throw new Error('You are not authorized to use this application.');
  }
  return user;
}

/** Throws if the caller is not an enabled admin. Returns the user record. */
function requireAdmin_() {
  var user = requireAuth_();
  if (user.role !== ROLE_ADMIN) {
    throw new Error('This action requires an administrator.');
  }
  return user;
}

/* ---------------- Admin: manage authorized users ---------------- */

function listUsers() {
  requireAdmin_();
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    out.push(rowToObject_(headers, rows[i]));
  }
  return out;
}

function addUser(email, role) {
  requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  if (!isValidEmail_(email)) throw new Error('Enter a valid email address.');
  role = (role === ROLE_ADMIN) ? ROLE_ADMIN : ROLE_FAMILY;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getUsersSheet_();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toLowerCase() === email) {
        throw new Error('That email is already authorized.');
      }
    }
    sheet.appendRow([email, role, true, new Date()]);
  } finally {
    lock.releaseLock();
  }
  return listUsers();
}

function setUserEnabled(email, enabled) {
  requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getUsersSheet_();
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email) {
        sheet.getRange(i + 1, 3).setValue(!!enabled); // 'enabled' column
        return listUsers();
      }
    }
    throw new Error('User not found.');
  } finally {
    lock.releaseLock();
  }
}

function setUserRole(email, role) {
  requireAdmin_();
  email = String(email || '').trim().toLowerCase();
  role = (role === ROLE_ADMIN) ? ROLE_ADMIN : ROLE_FAMILY;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getUsersSheet_();
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email) {
        sheet.getRange(i + 1, 2).setValue(role); // 'role' column
        return listUsers();
      }
    }
    throw new Error('User not found.');
  } finally {
    lock.releaseLock();
  }
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
