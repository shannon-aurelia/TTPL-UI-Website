create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  npm text unique,
  full_name text not null,
  role text not null default 'student' check (role in ('student','assistant','admin')),
  group_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.practicum_sessions (
  id uuid primary key default gen_random_uuid(),
  source_row_key text unique not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_number integer not null,
  track text not null check (track in ('rl','idp','t3')),
  module_number integer not null check (module_number between 1 and 8),
  report_group text not null,
  report_label text not null,
  scheduled_at timestamptz not null,
  attendance_status text not null default 'scheduled' check (attendance_status in ('scheduled','on_time','late','absent','excused')),
  attended_at timestamptz,
  is_makeup boolean not null default false,
  makeup_for_source_key text,
  submission_open boolean not null default false,
  deadline_at timestamptz,
  notes text,
  sheet_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null references public.practicum_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('rl','idp','t3')),
  report_group text not null,
  week_number integer not null,
  original_file_name text not null,
  stored_file_name text not null,
  file_path text not null,
  submitted_at timestamptz not null default now(),
  minutes_late integer not null default 0,
  late_penalty integer not null default 0 check (late_penalty between 0 and 100),
  status text not null default 'submitted' check (status in ('submitted','screening','ready_for_emas','uploaded_to_emas','failed')),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz not null default now(),
  row_count integer not null default 0,
  result jsonb not null default '[]'::jsonb
);

create table if not exists public.grade_imports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  report_group text not null,
  grade numeric(5,2),
  released boolean not null default false,
  source_row_key text unique,
  imported_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, npm, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'npm', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('assistant','admin')
  );
$$;

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

alter table public.profiles enable row level security;
alter table public.practicum_sessions enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_reviews enable row level security;
alter table public.sheet_sync_runs enable row level security;
alter table public.grade_imports enable row level security;

create policy "profiles read own or staff" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles insert own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update own basic record" on public.profiles for update using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());

create policy "sessions read own or staff" on public.practicum_sessions for select using (student_id = auth.uid() or public.is_staff());
create policy "sessions staff write" on public.practicum_sessions for all using (public.is_staff()) with check (public.is_staff());

create policy "submissions read own or staff" on public.submissions for select using (student_id = auth.uid() or public.is_staff());
create policy "students insert own open submission" on public.submissions for insert with check (
  student_id = auth.uid() and exists (
    select 1 from public.practicum_sessions session
    where session.id = session_id and session.student_id = auth.uid() and session.submission_open = true
  )
);
create policy "students replace own submission" on public.submissions for update using (student_id = auth.uid() or public.is_staff()) with check (student_id = auth.uid() or public.is_staff());
create policy "staff delete submissions" on public.submissions for delete using (public.is_staff());

create policy "staff read reviews" on public.submission_reviews for select using (public.is_staff());
create policy "students read released reviews" on public.submission_reviews for select using (
  grade_released = true and exists (
    select 1 from public.submissions
    where submissions.id = submission_id and submissions.student_id = auth.uid()
  )
);
create policy "staff manage reviews" on public.submission_reviews for all using (public.is_staff()) with check (public.is_staff());

create policy "staff read sync runs" on public.sheet_sync_runs for select using (public.is_staff());
create policy "staff read grade imports" on public.grade_imports for select using (public.is_staff());
create policy "students read released imported grades" on public.grade_imports for select using (student_id = auth.uid() and released = true);
create policy "staff manage grade imports" on public.grade_imports for all using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('practicum-reports', 'practicum-reports', false)
on conflict (id) do update set public = false;

create policy "students upload own reports" on storage.objects for insert to authenticated with check (
  bucket_id = 'practicum-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = 'pdf'
  and coalesce(metadata->>'mimetype', '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 20971520
);
create policy "students replace own reports" on storage.objects for update to authenticated using (
  bucket_id = 'practicum-reports' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
) with check (
  bucket_id = 'practicum-reports'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  and lower(storage.extension(name)) = 'pdf'
  and coalesce(metadata->>'mimetype', '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 20971520
);
create policy "students read own reports" on storage.objects for select to authenticated using (
  bucket_id = 'practicum-reports' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
);
create policy "staff delete reports" on storage.objects for delete to authenticated using (
  bucket_id = 'practicum-reports' and public.is_staff()
);

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

drop trigger if exists protect_submission_review_fields on public.submissions;
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

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.secure_student_submission() from anon, authenticated;
revoke execute on function public.require_ui_email() from anon, authenticated;
revoke execute on function public.prevent_profile_role_change() from anon, authenticated;
revoke execute on function public.is_staff() from anon;
revoke execute on function public.is_admin() from anon;

revoke update on public.profiles from authenticated;
grant update (full_name, npm, group_name, updated_at) on public.profiles to authenticated;
