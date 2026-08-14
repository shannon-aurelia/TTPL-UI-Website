create table if not exists public.submission_reviews (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  plagiarism_status text not null default 'pending' check (plagiarism_status in ('pending','processing','clear','review')),
  similarity_score numeric(5,2),
  grade numeric(5,2) check (grade between 0 and 100),
  feedback text,
  grade_released boolean not null default false,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.submission_reviews (
  submission_id,
  plagiarism_status,
  similarity_score,
  grade,
  feedback,
  grade_released,
  graded_by,
  graded_at,
  updated_at
)
select
  id,
  plagiarism_status,
  similarity_score,
  grade,
  feedback,
  grade_released,
  graded_by,
  graded_at,
  updated_at
from public.submissions
on conflict (submission_id) do nothing;

drop trigger if exists protect_submission_review_fields on public.submissions;
drop function if exists public.protect_submission_review_fields();

alter table public.submissions
  drop column if exists plagiarism_status,
  drop column if exists similarity_score,
  drop column if exists grade,
  drop column if exists feedback,
  drop column if exists grade_released,
  drop column if exists graded_by,
  drop column if exists graded_at;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.submission_reviews enable row level security;

create policy "staff read reviews" on public.submission_reviews
for select using (public.is_staff());

create policy "students read released reviews" on public.submission_reviews
for select using (
  grade_released = true and exists (
    select 1 from public.submissions
    where submissions.id = submission_id and submissions.student_id = auth.uid()
  )
);

create policy "staff manage reviews" on public.submission_reviews
for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.secure_student_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned public.practicum_sessions%rowtype;
begin
  if public.is_staff() then
    return new;
  end if;

  select * into assigned
  from public.practicum_sessions
  where id = new.session_id and student_id = auth.uid();

  if assigned.id is null
    or assigned.submission_open is not true
    or assigned.attendance_status not in ('on_time', 'late') then
    raise exception 'This assignment is not open for submission';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.session_id is distinct from old.session_id
    or new.student_id is distinct from old.student_id
  ) then
    raise exception 'Submission ownership cannot be changed';
  end if;

  new.student_id := auth.uid();
  new.track := assigned.track;
  new.report_group := assigned.report_group;
  new.week_number := assigned.week_number;
  new.submitted_at := now();
  new.minutes_late := case
    when assigned.deadline_at is null then 0
    else greatest(0, ceil(extract(epoch from (now() - assigned.deadline_at)) / 60.0)::integer)
  end;
  new.late_penalty := least(100, new.minutes_late * 10);
  new.status := 'submitted';
  new.updated_at := now();

  if new.file_path not like (auth.uid()::text || '/%') then
    raise exception 'Invalid report storage path';
  end if;

  return new;
end;
$$;

drop trigger if exists secure_student_submission on public.submissions;
create trigger secure_student_submission
before insert or update on public.submissions
for each row execute function public.secure_student_submission();

create or replace function public.admin_set_profile_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if new_role not in ('student', 'assistant', 'admin') then
    raise exception 'Invalid account role';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  update public.profiles set role = new_role, updated_at = now() where id = target_id;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;

revoke all on function public.admin_set_profile_role(uuid, text) from public;
revoke execute on function public.admin_set_profile_role(uuid, text) from anon;
grant execute on function public.admin_set_profile_role(uuid, text) to authenticated;

create or replace function public.require_ui_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if lower(new.email) not like '%@ui.ac.id' then
    raise exception 'An official UI email address is required';
  end if;
  new.email := lower(new.email);
  return new;
end;
$$;

drop trigger if exists require_ui_email on public.profiles;
create trigger require_ui_email
before insert or update of email on public.profiles
for each row execute function public.require_ui_email();

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only administrators can change account roles';
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'Account identity cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
before update on public.profiles
for each row execute function public.prevent_profile_role_change();

drop policy if exists "students upload own reports" on storage.objects;
create policy "students upload own reports" on storage.objects
for insert to authenticated with check (
  bucket_id = 'practicum-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = 'pdf'
  and coalesce(metadata->>'mimetype', '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 20971520
);

drop policy if exists "students replace own reports" on storage.objects;
create policy "students replace own reports" on storage.objects
for update to authenticated using (
  bucket_id = 'practicum-reports'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
) with check (
  bucket_id = 'practicum-reports'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  and lower(storage.extension(name)) = 'pdf'
  and coalesce(metadata->>'mimetype', '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 20971520
);

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.secure_student_submission() from anon, authenticated;
revoke execute on function public.require_ui_email() from anon, authenticated;
revoke execute on function public.prevent_profile_role_change() from anon, authenticated;
revoke execute on function public.is_staff() from anon;
revoke execute on function public.is_admin() from anon;
