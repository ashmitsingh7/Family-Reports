/**
 * Email.gs
 * Sends only a plain reminder to get a routine blood test.
 * Never includes report contents, attachments, values, or diagnoses.
 */

function sendReminderEmail_(person) {
  var appName = getAppNameSafe_();
  var subject = 'Blood Test Reminder';
  var body =
    'Hello,\n\n' +
    'This is a reminder that it has been ' + (Number(person.reminder_interval_months) || getDefaultReminderMonths_()) +
    ' months since your last blood test was recorded in the family health records system.\n\n' +
    'Please consider getting your routine blood test done.\n\n' +
    appName + ' Health';

  var htmlBody =
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; ' +
    'color:#111; background:#ffffff; max-width:480px; margin:0 auto; padding:32px 24px;">' +
    '<p style="font-size:15px; line-height:1.6;">Hello,</p>' +
    '<p style="font-size:15px; line-height:1.6;">This is a reminder that it has been ' +
    (Number(person.reminder_interval_months) || getDefaultReminderMonths_()) +
    ' months since your last blood test was recorded in the family health records system.</p>' +
    '<p style="font-size:15px; line-height:1.6;">Please consider getting your routine blood test done.</p>' +
    '<p style="font-size:13px; color:#666; margin-top:32px;">' + appName + ' Health</p>' +
    '</div>';

  MailApp.sendEmail({
    to: person.email,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    noReply: true
  });
}

/** Manually trigger a test email to yourself from the Apps Script editor. */
function sendTestReminderEmail() {
  var email = getActiveEmail_();
  sendReminderEmail_({ email: email, reminder_interval_months: getDefaultReminderMonths_() });
}
