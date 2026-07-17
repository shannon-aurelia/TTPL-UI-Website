# Google Sheets Attendance and Scheduling Template

Use one row for one student in one practicum session. This long-format structure is more reliable than placing every week inside one cell because it supports different modules in the same week, absences, izin, late arrivals, schedule changes, and makeup sessions without overwriting history.

The first columns still identify the student, while the remaining columns describe that specific week's session.

## Required sheet tab

Create a tab named `Practicum_Events` with these exact headers:

| Column | Purpose |
|---|---|
| source_key | Permanent unique row ID, such as `2026-RL-W03-2306123456-M7` |
| npm | Student NPM matching the website account |
| full_name | Student name for human checking |
| email | UI email for human checking |
| week_number | Semester week number |
| track | `rl`, `idp`, or `t3` |
| module_number | Module number from 1 to 8 |
| scheduled_date | Planned date in `YYYY-MM-DD` |
| scheduled_start | Planned start time in `HH:MM` |
| attendance_status | `scheduled`, `on_time`, `late`, `absent`, or `excused` |
| attended_date | Actual attendance date in `YYYY-MM-DD`; leave blank before attendance |
| attended_time | Actual arrival time in `HH:MM`; leave blank before attendance |
| is_makeup | `true` or `false` |
| makeup_for_source_key | Original absent or excused row ID when this is a makeup session |
| submission_override | Blank for automatic behavior, `open`, or `closed` |
| deadline_override | Optional full local date and time in `YYYY-MM-DDTHH:MM:SS` |
| notes | Assistant notes |

## Example rows

```csv
source_key,npm,full_name,email,week_number,track,module_number,scheduled_date,scheduled_start,attendance_status,attended_date,attended_time,is_makeup,makeup_for_source_key,submission_override,deadline_override,notes
2026-RL-W03-2306123456-M7,2306123456,Example Student,example@ui.ac.id,3,rl,7,2026-09-15,13:00,on_time,2026-09-15,12:56,false,,,,Regular attendance
2026-RL-W03-2306987654-M2,2306987654,Second Student,second@ui.ac.id,3,rl,2,2026-09-15,13:00,absent,,,false,,,,Submission remains closed
2026-RL-W05-2306987654-M2-MAKEUP,2306987654,Second Student,second@ui.ac.id,5,rl,2,2026-09-29,09:00,on_time,2026-09-29,08:58,true,2026-RL-W03-2306987654-M2,,,Makeup for Week 3
2026-IDP-W09-2306123456-M8,2306123456,Example Student,example@ui.ac.id,9,idp,8,2026-11-10,08:00,late,2026-11-10,08:11,false,,,,Late attendance does not close report upload
2026-IDP-W10-2306987654-M7,2306987654,Second Student,second@ui.ac.id,10,idp,7,2026-11-17,08:00,excused,,,false,,,,Waiting for makeup schedule
```

## How the website interprets the status

- `scheduled`: session appears as upcoming; report upload stays closed until attendance is updated
- `on_time`: submission opens and the deadline is calculated
- `late`: submission opens and the deadline is calculated; attendance lateness is separate from report lateness
- `absent`: the assigned module remains visible, but report upload is unavailable
- `excused`: the assigned module remains visible, but report upload is unavailable
- Makeup: add a new row with `is_makeup=true` and reference the original row in `makeup_for_source_key`; the new row receives its own deadline

## Deadline rule

The synchronization route currently sets the report deadline to two calendar days after the actual attendance date at 00:05 WIB.

Example: attendance on Tuesday creates a Thursday 00:05 WIB deadline.

A report is penalized by 10 points for every started minute after the deadline. The penalty is capped at 100 points, so a file submitted at 00:15 after a 00:05 deadline receives a 100-point deduction.

## Optional convenience tabs

You may create a `Weekly_View` tab using a pivot table for assistants who prefer a matrix with students on the left and weeks across the top. Do not synchronize that pivot tab. The website should synchronize the normalized `Practicum_Events` tab because it preserves makeup and attendance history.

You may also create a `Grades` tab with these columns:

```text
source_key,npm,report_group,grade,released
```

Grade synchronization is a documented placeholder. The database already contains grade fields and release controls.
