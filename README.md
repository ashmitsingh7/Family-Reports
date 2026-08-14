# Family

A private family health-record filing cabinet with a reminder system.

Upload → Store → Remember → Remind. Nothing more.

- Runs entirely on Google Apps Script (HTML Service web app), Google Sheets (database), Google Drive (private file storage), and MailApp (reminder emails).
- No paid services, no third-party backend, no AI, no OCR, no medical analysis of any kind. Reports are stored as opaque files; the app only tracks who they belong to, the test date, and an optional comment.
- Every 3 months (configurable per person) after their latest report, a person gets a plain reminder email to get a routine blood test. Uploading a newer report always cancels the pending reminder and schedules a fresh one.

## Project layout

```
family-health-records/
├── README.md
├── SETUP.md
├── backend/
│   ├── Code.gs          - doGet, sheet helpers, initializeApplication()
│   ├── Config.gs         - PropertiesService-backed configuration
│   ├── Auth.gs           - allowlist, roles (ADMIN/FAMILY), session user
│   ├── People.gs         - family member CRUD
│   ├── Reports.gs        - report metadata CRUD, file access authorization
│   ├── Reminders.gs      - calendar-month math, reschedule-on-upload, daily checkReminders()
│   ├── Email.gs          - plain-text reminder email
│   ├── DriveStorage.gs   - private file save/read, no public sharing
│   └── Backup.gs         - metadata export + repeat-safe file backup
└── frontend/
    ├── index.html         - top-level template (evaluated by doGet)
    ├── styles.html         - dark, Apple-utility design system
    └── app.html            - the client SPA (vanilla JS, google.script.run)
```

See `SETUP.md` for step-by-step deployment instructions.

## Design philosophy

Black background, white text, a single accent (white buttons on black), flat rows instead of colorful cards, no charts, no health scores, no AI-generated insights. See the full spec this was built from for the complete rationale — the short version: **less over more, simple over clever, private over public, original files over processed files.**
