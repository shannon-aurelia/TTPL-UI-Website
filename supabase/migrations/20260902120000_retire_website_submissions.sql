-- EMAS3 is the only report-submission channel from September 2026 onward.
-- Preserve all historical rows and files, but close website submission access.

update public.practicum_sessions
set submission_open = false,
    deadline_at = null
where submission_open is true or deadline_at is not null;

drop policy if exists "students insert own open submission" on public.submissions;
drop policy if exists "students replace own submission" on public.submissions;

drop policy if exists "students upload own reports" on storage.objects;
drop policy if exists "students replace own reports" on storage.objects;

comment on table public.submissions is
  'Historical TTPL website report records. New reports are submitted through EMAS3.';
