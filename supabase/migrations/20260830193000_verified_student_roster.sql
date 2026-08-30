create table if not exists public.student_roster (
  id uuid primary key default gen_random_uuid(),
  npm text not null unique check (npm ~ '^[0-9]{10}$'),
  full_name text not null,
  class_type text not null check (class_type in ('kki','regular')),
  ui_email text unique,
  gmail_email text unique,
  claimed_by uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_roster enable row level security;
revoke all on public.student_roster from anon, authenticated;
grant select on public.student_roster to authenticated;

drop policy if exists "staff manage student roster" on public.student_roster;
create policy "staff manage student roster" on public.student_roster
for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.profiles add column if not exists gmail_email text;
grant update (gmail_email) on public.profiles to authenticated;
create unique index if not exists profiles_gmail_email_unique
on public.profiles (lower(gmail_email)) where gmail_email is not null;

alter table public.student_module_plans add column if not exists roster_id uuid references public.student_roster(id) on delete cascade;
alter table public.student_module_plans alter column student_id drop not null;
alter table public.student_module_plans drop constraint if exists student_module_plans_identity_check;
alter table public.student_module_plans add constraint student_module_plans_identity_check
check (student_id is not null or roster_id is not null);
create unique index if not exists student_module_plans_roster_unique
on public.student_module_plans (roster_id, track, planned_week_start, report_group)
where roster_id is not null;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_roster'
  ) then
    alter publication supabase_realtime add table public.student_roster;
  end if;
end $$;

-- Roster rows contain private student data and are imported directly into the
-- protected database. They are intentionally excluded from this public repo.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  assigned_role text;
  clean_npm text;
  clean_gmail text;
  selected_roster public.student_roster%rowtype;
begin
  select coalesce(
    (select role from private.staff_email_allowlist where email = lower(new.email)),
    'student'
  ) into assigned_role;

  if assigned_role in ('assistant', 'admin') then
    insert into public.profiles (id, email, full_name, npm, role)
    values (
      new.id,
      lower(new.email),
      coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
      nullif(trim(new.raw_user_meta_data->>'npm'), ''),
      assigned_role
    )
    on conflict (id) do update set
      email = excluded.email,
      role = excluded.role;
    return new;
  end if;

  if lower(new.email) !~ '@(student\.)?ui\.ac\.id$' then
    raise exception 'Student registration requires an official UI email';
  end if;

  clean_npm := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'npm', ''), '[^0-9]', '', 'g'), '');
  clean_gmail := lower(nullif(trim(coalesce(new.raw_user_meta_data->>'gmail_email', '')), ''));
  if clean_gmail is null or clean_gmail !~ '@gmail\.com$' then
    raise exception 'A valid Gmail address is required';
  end if;

  select * into selected_roster
  from public.student_roster
  where id = (new.raw_user_meta_data->>'roster_id')::uuid
    and npm = clean_npm
    and is_active
  for update;

  if selected_roster.id is null then
    raise exception 'The selected student and NPM do not match the TTPL roster';
  end if;
  if selected_roster.claimed_by is not null then
    raise exception 'This student roster entry has already been registered';
  end if;
  if exists (select 1 from public.student_roster where lower(gmail_email) = clean_gmail and id <> selected_roster.id) then
    raise exception 'This Gmail address is already linked to another student';
  end if;

  update public.student_roster
  set claimed_by = new.id,
      claimed_at = now(),
      ui_email = lower(new.email),
      gmail_email = clean_gmail,
      updated_at = now()
  where id = selected_roster.id;

  insert into public.profiles (id, email, gmail_email, full_name, npm, role, study_program, is_active)
  values (
    new.id,
    lower(new.email),
    clean_gmail,
    selected_roster.full_name,
    selected_roster.npm,
    'student',
    'Electrical Engineering',
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    gmail_email = excluded.gmail_email,
    full_name = excluded.full_name,
    npm = excluded.npm,
    role = 'student';

  update public.student_module_plans
  set student_id = new.id, updated_at = now()
  where roster_id = selected_roster.id and student_id is null;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
