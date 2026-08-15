create table if not exists public.reading_comments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('rl','idp','t3')),
  module_number integer not null check (module_number between 1 and 8),
  document_path text not null,
  page_number integer not null check (page_number > 0),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reading_comments_student_document_idx
on public.reading_comments(student_id, track, module_number, document_path, page_number);

create index if not exists reading_comments_staff_idx
on public.reading_comments(track, module_number, created_at desc);

alter table public.reading_comments enable row level security;

drop policy if exists "students read own reading comments" on public.reading_comments;
create policy "students read own reading comments"
on public.reading_comments for select
to authenticated
using ((select auth.uid()) = student_id or public.is_staff());

drop policy if exists "students create own reading comments" on public.reading_comments;
create policy "students create own reading comments"
on public.reading_comments for insert
to authenticated
with check ((select auth.uid()) = student_id);

drop policy if exists "students update own reading comments" on public.reading_comments;
create policy "students update own reading comments"
on public.reading_comments for update
to authenticated
using ((select auth.uid()) = student_id)
with check ((select auth.uid()) = student_id);

drop policy if exists "students delete own reading comments" on public.reading_comments;
create policy "students delete own reading comments"
on public.reading_comments for delete
to authenticated
using ((select auth.uid()) = student_id);

grant select, insert, update, delete on public.reading_comments to authenticated;

comment on table public.reading_comments is 'Student page-linked notes on tracked TTPL PDFs. Students manage their own notes; assistants and admins may read them for practicum support.';
