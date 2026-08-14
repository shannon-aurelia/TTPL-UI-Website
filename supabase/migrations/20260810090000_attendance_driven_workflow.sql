create table if not exists public.lab_settings (
  id boolean primary key default true check (id = true),
  allow_external_student_registration boolean not null default true,
  allowed_email_domains text[] not null default array['ui.ac.id','student.ui.ac.id'],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.lab_settings (id) values (true) on conflict (id) do nothing;

alter table public.practicum_sessions
  add column if not exists qna_score numeric(5,2),
  add column if not exists deadline_override_reason text,
  add column if not exists deadline_updated_by uuid references public.profiles(id);

create table if not exists public.student_module_plans (
  id uuid primary key default gen_random_uuid(),
  source_row_key text unique not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('rl','idp','t3')),
  week_number integer not null,
  module_number integer not null check (module_number between 1 and 8),
  report_group text not null,
  report_label text not null,
  planned_week_start date not null,
  status text not null default 'expected' check (status in ('expected','deferred','completed')),
  completed_session_id uuid references public.practicum_sessions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, track, planned_week_start, report_group)
);

alter table public.submissions
  add column if not exists drive_file_id text,
  add column if not exists drive_file_url text,
  add column if not exists drive_sync_status text not null default 'pending'
    check (drive_sync_status in ('pending','synced','failed'));

alter table public.lab_settings enable row level security;
alter table public.student_module_plans enable row level security;

drop policy if exists "registration settings are readable" on public.lab_settings;
create policy "registration settings are readable" on public.lab_settings
for select to anon, authenticated using (true);

drop policy if exists "admins update registration settings" on public.lab_settings;
create policy "admins update registration settings" on public.lab_settings
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "plans read own or staff" on public.student_module_plans;
create policy "plans read own or staff" on public.student_module_plans
for select to authenticated using (student_id = (select auth.uid()) or public.is_staff());

drop policy if exists "staff manage plans" on public.student_module_plans;
create policy "staff manage plans" on public.student_module_plans
for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select on public.lab_settings to anon, authenticated;
grant update on public.lab_settings to authenticated;
revoke all on public.student_module_plans from anon;
grant select, insert, update, delete on public.student_module_plans to authenticated;

create or replace function public.require_ui_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  settings public.lab_settings%rowtype;
  email_domain text;
begin
  select * into settings from public.lab_settings where id = true;
  email_domain := split_part(lower(new.email), '@', 2);
  if settings.allow_external_student_registration is not true
    and not (email_domain = any(settings.allowed_email_domains)) then
    raise exception 'An official UI email address is required';
  end if;
  new.email := lower(new.email);
  return new;
end;
$$;

revoke execute on function public.require_ui_email() from public, anon, authenticated;

create or replace function public.staff_record_attendance(
  target_student_id uuid,
  selected_track text,
  selected_module integer,
  selected_week integer,
  attended_time timestamptz,
  score numeric default null,
  makeup boolean default false,
  attendance_notes text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  group_id text;
  group_label text;
  session_id uuid;
  deadline_value timestamptz;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if selected_track not in ('rl','idp','t3') or selected_module not between 1 and 8 then
    raise exception 'Invalid practicum module';
  end if;

  group_id := case
    when selected_track = 'rl' and selected_module = 1 then 'rl-pretest'
    when selected_track = 'rl' and selected_module in (2,3) then 'rl-2-3'
    when selected_track = 'rl' and selected_module in (4,5) then 'rl-4-5'
    when selected_track = 'rl' then 'rl-' || selected_module
    when selected_track = 'idp' and selected_module = 1 then 'idp-pretest'
    when selected_track = 'idp' then 'idp-' || selected_module
    when selected_track = 't3' then 't3-' || selected_module
  end;
  group_label := case
    when group_id = 'rl-2-3' then 'Modules 2-3 Combined Report'
    when group_id = 'rl-4-5' then 'Modules 4-5 Combined Report'
    when group_id like '%pretest' then upper(selected_track) || ' Pre-test'
    else upper(selected_track) || ' Module ' || selected_module || ' Report'
  end;
  deadline_value := ((attended_time at time zone 'Asia/Jakarta')::date + 1 + time '23:59') at time zone 'Asia/Jakarta';

  insert into public.practicum_sessions (
    source_row_key, student_id, week_number, track, module_number, report_group, report_label,
    scheduled_at, attendance_status, attended_at, is_makeup, submission_open, deadline_at,
    qna_score, notes, sheet_updated_at
  ) values (
    'admin-' || gen_random_uuid()::text, target_student_id, selected_week, selected_track,
    selected_module, group_id, group_label, attended_time, 'on_time', attended_time, makeup,
    group_id not in ('rl-pretest','idp-pretest','t3-8'),
    case when group_id in ('rl-pretest','idp-pretest','t3-8') then null else deadline_value end,
    score, attendance_notes, now()
  ) returning id into session_id;

  update public.student_module_plans
  set status = 'completed', completed_session_id = session_id, updated_at = now()
  where student_id = target_student_id
    and track = selected_track
    and report_group = group_id
    and week_number = selected_week;

  return session_id;
end;
$$;

revoke all on function public.staff_record_attendance(uuid,text,integer,integer,timestamptz,numeric,boolean,text) from public, anon;
grant execute on function public.staff_record_attendance(uuid,text,integer,integer,timestamptz,numeric,boolean,text) to authenticated;

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf']
where id = 'practicum-reports';

create index if not exists student_module_plans_student_id_idx on public.student_module_plans(student_id);
create index if not exists student_module_plans_completed_session_id_idx on public.student_module_plans(completed_session_id);
create index if not exists practicum_sessions_deadline_updated_by_idx on public.practicum_sessions(deadline_updated_by);
