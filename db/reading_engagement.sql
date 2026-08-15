create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('rl','idp','t3')),
  module_number integer not null check (module_number between 1 and 8),
  document_path text not null,
  document_title text,
  total_pages integer not null default 0 check (total_pages >= 0),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  idle_seconds integer not null default 0 check (idle_seconds >= 0),
  max_scroll_depth numeric(5,2) not null default 0 check (max_scroll_depth between 0 and 100),
  pages_seen integer[] not null default '{}',
  page_seconds jsonb not null default '{}'::jsonb,
  focus_losses integer not null default 0 check (focus_losses >= 0),
  completion_percent numeric(5,2) not null default 0 check (completion_percent between 0 and 100),
  engagement_score numeric(5,2) not null default 0 check (engagement_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reading_sessions_student_idx on public.reading_sessions(student_id, track, module_number);
create index if not exists reading_sessions_staff_idx on public.reading_sessions(track, module_number, last_seen_at desc);

alter table public.reading_sessions enable row level security;

drop policy if exists "reading sessions read own or staff" on public.reading_sessions;
create policy "reading sessions read own or staff"
on public.reading_sessions for select
to authenticated
using ((select auth.uid()) = student_id or public.is_staff());

drop policy if exists "students create own reading sessions" on public.reading_sessions;
create policy "students create own reading sessions"
on public.reading_sessions for insert
to authenticated
with check ((select auth.uid()) = student_id);

drop policy if exists "students update own reading sessions" on public.reading_sessions;
create policy "students update own reading sessions"
on public.reading_sessions for update
to authenticated
using ((select auth.uid()) = student_id)
with check ((select auth.uid()) = student_id);

grant select, insert, update on public.reading_sessions to authenticated;

comment on table public.reading_sessions is 'Aggregated TTPL PDF reading engagement telemetry. This measures interaction, not comprehension.';
