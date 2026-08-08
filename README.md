# TTPL UI Digital Practicum Platform

TTPL UI is a public laboratory website and practicum management platform for Laboratorium Tegangan Tinggi dan Pengukuran Listrik, Departemen Teknik Elektro FTUI.

The repository combines the public-facing TTPL profile, practicum materials, official YouTube resources, multilingual navigation, visual backgrounds, RL/IDP/T3 virtual laboratories, student accounts, personalized schedules, report submissions, and an assistant review dashboard.

## Main areas

- Public homepage, laboratory profile, news, assistants, alumni, clients, and current initiatives
- Practicum tracks for Rangkaian Listrik, Instrumentation and Measurement, and High Voltage and High Current
- Downloadable PDF modules and links to the TTPL FTUI YouTube channel
- Separate virtual laboratories for RL, IDP, and T3
- Supabase email/password accounts for students, assistants, and administrators
- Student dashboard driven by each student's imported schedule and attendance
- Report uploads available from both the dashboard and the relevant practicum page
- Private PDF storage in Supabase Storage
- Assistant dashboard grouped by student, module, week, attendance, deadline, and submission status
- Administrator portal for account roles, assignments, submission windows, reviews, and grade release
- Google Sheets attendance synchronization endpoint
- Late submission calculation and grade-release controls

## RL report structure

- Module 1: offline pre-test, resources and schedule only
- Modules 2 and 3: one combined report
- Modules 4 and 5: one combined report
- Module 6: one report
- Module 7: one report
- Module 8: one report

IDP Module 1 is currently a schedule placeholder. If the pre-test is later held online, it should link to EMAS rather than collect the pre-test on this website.

## Local setup

1. Install Node.js 20 LTS.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project and follow `DATA_SETUP_GUIDE.md`.
4. Run:

```bash
npm install
npm run dev
```

5. Open `http://localhost:3000`.

The dependency list is intentionally small so installation is faster. The old local SQLite prototype is no longer used by the active pages.

## Production deployment

The project is compatible with Vercel. Add all environment variables from `.env.local` to the Vercel project settings. Never expose `SUPABASE_SERVICE_ROLE_KEY` in a variable beginning with `NEXT_PUBLIC_`.

## Documentation

- `EDIT_GUIDE.md`: where to edit content, navigation, visuals, modules, translations, and virtual labs
- `DATA_SETUP_GUIDE.md`: Supabase setup, accounts, storage, Google Sheets structure, synchronization, deadlines, grades, and testing
- `GOOGLE_SHEETS_TEMPLATE.md`: exact attendance spreadsheet columns and examples for absence, izin, lateness, and makeup sessions
