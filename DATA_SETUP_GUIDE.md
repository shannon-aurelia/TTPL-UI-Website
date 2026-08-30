# Data, Accounts, and Supabase Setup Guide

## 1. Create Supabase

1. Create a new project in Supabase.
2. Open SQL Editor.
3. Paste and run `supabase/schema.sql` for a new project. For an existing project, run the files in `supabase/migrations` in filename order.
4. Open Project Settings, then API.
5. Copy the Project URL, anon key, and service role key.
6. Create `.env.local` from `.env.example` and fill the values.
7. Restart `npm run dev` after changing environment variables.

## 2. Test a real student account

1. Open `/login`.
2. Choose create student account.
3. Enter full name, NPM, UI email, and a password with at least eight characters.
4. If email confirmation is enabled in Supabase, confirm the message.
5. Sign in again.
6. The account appears in Supabase Authentication and in the `profiles` table.

The profile NPM must exactly match the NPM in the attendance sheet. This is how imported schedule rows are attached to the correct account.

## 3. Create the first administrator

1. Register your own account through `/login` using an `@ui.ac.id` email.
2. Open the `profiles` table in Supabase.
3. Change your account's `role` from `student` to `admin`.
4. Sign out and sign in again.
5. Open `/admin` to manage account roles, assignments, submission windows, report reviews, and grade release.

The first administrator is the only account that needs to be promoted manually. After that, administrators can assign student, assistant, or administrator access from the Accounts tab.

## 4. Create an assistant account

1. Register normally through `/login` or create the user in Supabase Authentication.
2. Open Table Editor, then `profiles`.
3. Change `role` from `student` to `assistant`, or let an administrator change it from `/admin`.
4. Sign out and sign in again.
5. The account is redirected to `/assistant-dashboard`.

Use `admin` only for coordinators who should have full access.

## 5. Configure the Google Sheet

Follow `GOOGLE_SHEETS_TEMPLATE.md` exactly.

Publish only the `Practicum_Events` tab as CSV, or create an export URL:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=TAB_GID
```

Put that URL in `ATTENDANCE_SHEET_CSV_URL`.

The sheet can be publicly readable without being publicly editable. Never publish private grades in the same public tab.

## 6. Synchronize attendance

The route is:

```text
POST /api/sync-attendance
```

It requires this request header:

```text
x-sync-secret: the value of ATTENDANCE_SYNC_SECRET
```

For local testing:

```bash
curl -X POST http://localhost:3000/api/sync-attendance \
  -H "x-sync-secret: YOUR_SECRET"
```

The route downloads the CSV, finds each student by NPM, maps the assigned module to its report group, calculates submission availability and deadlines, and upserts the session using `source_key`.

You can later call this route from a scheduled Vercel Cron job or add a protected sync button for administrators.

## 7. Submission behavior

A student sees only their own imported sessions.

- A scheduled session is visible but not uploadable before attendance confirmation.
- An on-time or late attendance row opens the correct report submission.
- An absent or excused row remains visible but is locked.
- A makeup row creates a new active assignment and deadline.
- Module 1 RL never accepts a report.
- RL Modules 2–3 and 4–5 use combined report groups.
- RL Modules 6, 7, and 8 are separate.
- IDP Modules 2–8 are available as separate report groups.

The uploaded PDF is renamed automatically using:

```text
Full_Name_NPM_Report_Group_WeekN.pdf
```

The file is stored privately in the `practicum-reports` bucket. Students can access only their own folder. Staff can access all reports through signed URLs.

Only PDF files up to 30 MB are accepted. The database records the upload-start time and accepts it only after the PDF finishes uploading, so those values cannot be changed from the browser.

## 8. Late penalty

The active rule is 10 points per started minute late, capped at 100 points.

```text
penalty = min(100, ceil(minutes late) × 10)
```

The system stores the submission timestamp, minutes late, and penalty separately so the laboratory can change grading policy later without losing the original timing data.

## 9. Grades

Assistants can enter a grade and keep `grade_released` off during the semester. Review data is stored separately from student-readable submission data. Students can read a review only after its grade has been released.

## 10. Plagiarism and EMAS automation placeholders

The `submission_reviews` and `submissions` tables contain:

- `plagiarism_status`
- `similarity_score`
- `status`

A future screening worker can change the flow from `submitted` to `screening`, then `ready_for_emas`, and finally `uploaded_to_emas`. Keep browser automation outside the Next.js request process, preferably as a queued worker.

## 11. GitHub and Vercel

Before pushing to GitHub:

- Keep `.env.local` out of Git
- Never commit the service role key
- Confirm `.gitignore` includes `.env*`, except `.env.example`
- Run `npm run build`

In Vercel, add the same environment variables under Project Settings, then deploy.
