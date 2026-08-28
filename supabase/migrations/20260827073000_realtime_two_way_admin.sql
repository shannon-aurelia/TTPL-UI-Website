alter table public.profiles
  add column if not exists is_active boolean not null default true;

alter table public.profiles
  add column if not exists sync_managed boolean not null default false;

alter table public.student_module_plans
  add column if not exists sync_managed boolean not null default false;

create index if not exists student_module_plans_sync_managed_idx
  on public.student_module_plans(sync_managed, source_row_key);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'practicum_sessions'
  ) then
    alter publication supabase_realtime add table public.practicum_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_module_plans'
  ) then
    alter publication supabase_realtime add table public.student_module_plans;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end
$$;
