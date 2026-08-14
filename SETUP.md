# Setup

This walks through deploying **Family** for real, using only your Google account. No command line needed except copy/paste into the Apps Script editor.

## Step 1 — Create the Apps Script project

1. Go to https://script.google.com and click **New project**.
2. Rename it (top left) to `Family`.

You don't need to separately create a Drive folder or Spreadsheet — `initializeApplication()` (Step 5) creates both for you automatically the first time it runs.

## Step 2 — Add the backend files

In the Apps Script editor, for each file in `backend/`:
1. Click the **+** next to Files → **Script**.
2. Name it exactly as the filename without `.gs` (e.g. `Code`, `Config`, `Auth`, `People`, `Reports`, `Reminders`, `Email`, `DriveStorage`, `Backup`).
3. Paste in the matching file's contents.

Delete the default empty `Code.gs` the editor creates for you first, or just paste over it for the `Code` file.

## Step 3 — Add the frontend files

For each file in `frontend/`:
1. Click **+** → **HTML**.
2. Name it `index`, `styles`, and `app` respectively (Apps Script adds `.html` automatically).
3. Paste in the matching contents.

## Step 4 — Run initialization

1. In the Apps Script editor toolbar, select the function dropdown and choose `initializeApplication`.
2. Click **Run**.
3. The first time, Google will ask you to authorize the script (Drive, Sheets, Gmail send, and trigger permissions). Review and accept — this is expected, since the app needs to create your Sheet, Drive folders, and a daily trigger.
4. Check the execution log (View → Logs) — it returns the new spreadsheet and Drive folder URLs. Open them to confirm they were created.
5. This also automatically adds **you** as the first `ADMIN` user, so you're never locked out.

Running `initializeApplication` again later is safe — it will not create duplicate sheets, folders, or triggers.

## Step 5 — Grant permissions

If prompted again on first web app load, sign in with the Google account you want to administer the app with and approve the requested scopes (Sheets, Drive, Gmail, and script triggers).

## Step 6 — Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Type: **Web app**.
3. Description: `Family v1`.
4. Execute as: **Me** (so the app always has access to the Sheet/Drive regardless of who's browsing).
5. Who has access: **Anyone with a Google account within your organization** if you use Google Workspace, or **Anyone with a Google account** for a personal Gmail-based family. (The app-level `Users` sheet is still the real gatekeeper — anyone not on that list sees only the "not authorized" screen.)
6. Click **Deploy**, then copy the **Web app URL**. This is the link your family will use.

## Step 7 — Configure authorized users

1. Open the app URL and sign in — as the initializing admin you'll already have access.
2. Go to **Settings → Authorized users**.
3. Add each family member's Google account email with role `Family` (or `Admin` if they should manage people/users/backups too).

## Step 8 — Add family members

1. Go to **People → + Add Person**.
2. Enter each person's name and email (this is who gets the reminder email — it doesn't have to match their login email if someone else manages their records).
3. Leave reminders on with the default 3-month interval, or adjust per person.

## Step 9 — Test upload

1. From the dashboard, **+ Upload Report** for one person.
2. Pick a test date and attach a sample PDF/JPG/PNG.
3. Confirm it appears in that person's Report history and the Drive folder `Family Health Records/Reports/Person_<id>/` (visible only to you, since files are private).

## Step 10 — Test the reminder date

1. Open the uploaded report — its person page should show **Next reminder** = the test date + the configured number of months (calendar months, so e.g. 31 Jan + 3 months → 30 Apr).
2. Upload a second, newer report for the same person and confirm the reminder date updates and there is still only one pending reminder (check the `Reminders` sheet — the old row should now say `CANCELLED`).

## Step 11 — Test the email

You don't have to wait 3 months to check the email wiring:
1. In the Apps Script editor, select `sendTestReminderEmail` from the function dropdown and click **Run**.
2. Check your inbox for the "Blood Test Reminder" email.

## Step 12 — Confirm the daily scheduler

`initializeApplication()` already created a daily trigger for `checkReminders` (Triggers panel, left sidebar, shows it running once a day). You can also select `checkReminders` in the function dropdown and click **Run** manually to process any due reminders immediately.

## Step 13 — Mobile check

Open the Web App URL on a phone (Android Chrome and iPhone Safari) and confirm the bottom navigation, upload flow, and report viewing all work without horizontal scrolling.

## Notes on Google's free-tier reality

- This uses your normal Google account's free Sheets, Drive, and Gmail/Apps Script quotas — there is no paid tier involved anywhere in this app.
- Consumer Gmail accounts have a **MailApp daily send quota** (historically around 100/day) — utterly sufficient for a family reminder system, but worth knowing if you ever connect dozens of people.
- Apps Script script executions are capped at **6 minutes** each and time-driven triggers run on Google's schedule (not to-the-minute) — fine for a once-a-day reminder check, not for anything needing sub-minute timing.
- Drive storage counts against your account's overall Google storage quota (15 GB free on a standard personal account) — plenty for scanned blood-test PDFs, but worth knowing if the family uploads years of large scans.
- If you ever outgrow these limits, that's a signal to review usage — not a reason to silently bolt on a paid service.

## Redeploying after changes

Whenever you edit any file, you must create a **new deployment version** (Deploy → Manage deployments → edit → New version) or the live Web App URL will keep serving the old code.
