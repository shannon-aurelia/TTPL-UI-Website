# TTPL Website Edit Guide

## Navigation and translation

Edit `components/Shell.jsx`.

The `dict` object contains English, Indonesian, and Chinese navigation and shared labels. The language selector and automatic browser-language detection are in the same file.

## Homepage

Edit `app/HomeClient.jsx`.

This file contains the landing-page sections, animated rail, background selector, current activities, laboratory profile content, and homepage cards. Background files are stored in `public/background-options`.

## Global styling

Edit `app/globals.css`.

The grid, dark and light mode, glass panels, title spacing, cards, dashboards, tables, forms, report upload rows, and responsive rules are all defined here.

## Practicum pages

- RL: `app/practicum/rl/page.jsx`
- IDP: `app/practicum/idp/page.jsx`
- T3: `app/practicum/t3/page.jsx`

Report grouping rules are stored in `lib/practicum.js`. Change the grouping there before changing upload behavior.

## Report upload interface

Edit `components/ReportSubmissionPanel.jsx`.

The component reads the logged-in student's imported sessions, hides unavailable submissions, names the PDF using the student's profile, uploads it to Supabase Storage, and writes submission metadata to the database.

## Student dashboard

Edit `app/portal/page.jsx`.

The page shows upcoming practicum sessions, attendance status, deadlines, progress, report submissions, and released grades.

## Assistant dashboard

Edit `app/assistant-dashboard/page.jsx`.

The page lists students and sessions by module and week. Assistants can open signed PDF links, update plagiarism status, enter a grade, and control whether the grade is released.

## Accounts

Edit `app/login/page.jsx` for the registration and login interface. Account state is provided by `components/AuthProvider.jsx`. Supabase client configuration is in `lib/supabaseClient.js`.

## Google Sheets synchronization

Edit `app/api/sync-attendance/route.js` if the spreadsheet structure or deadline rule changes. The required sheet columns are documented in `GOOGLE_SHEETS_TEMPLATE.md`.

## PDF modules

Files are in `public/modules`. Replace a PDF while keeping the same filename to update it without changing links.

## Virtual laboratories

- RL: `app/virtual-lab/rl/page.jsx`
- IDP: `app/virtual-lab/idp/page.jsx`
- T3: `app/virtual-lab/t3/page.jsx`

The uploaded T3 simulation and homepage/background work are preserved in the current repository.
