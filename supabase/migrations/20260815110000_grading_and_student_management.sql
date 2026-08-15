alter table public.profiles
  add column if not exists study_program text;

create table if not exists public.grade_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  track text not null default 'rl' check (track in ('rl', 'idp', 't3')),
  report_group text not null,
  item_type text not null check (item_type in ('pre_test', 'post_test', 'qna', 'tp', 'tutam', 'report_component', 'report_total')),
  component_code text not null default '',
  score numeric(5,2) check (score between 0 and 100),
  assistant_code text,
  submission_id uuid references public.submissions(id) on delete set null,
  released boolean not null default false,
  graded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, track, report_group, item_type, component_code)
);

alter table public.grade_entries enable row level security;

create policy "staff manage grade entries" on public.grade_entries
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "students read released grade entries" on public.grade_entries
for select to authenticated
using (student_id = (select auth.uid()) and released = true);

grant select, insert, update, delete on public.grade_entries to authenticated;

create or replace function public.staff_upsert_grade_entries(entries jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  saved integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  for item in select value from jsonb_array_elements(entries)
  loop
    insert into public.grade_entries (
      student_id, track, report_group, item_type, component_code, score,
      assistant_code, submission_id, released, graded_by, updated_at
    ) values (
      (item->>'student_id')::uuid,
      coalesce(nullif(item->>'track', ''), 'rl'),
      item->>'report_group',
      item->>'item_type',
      coalesce(item->>'component_code', ''),
      nullif(item->>'score', '')::numeric,
      nullif(upper(item->>'assistant_code'), ''),
      nullif(item->>'submission_id', '')::uuid,
      coalesce((item->>'released')::boolean, false),
      auth.uid(),
      now()
    )
    on conflict (student_id, track, report_group, item_type, component_code)
    do update set
      score = excluded.score,
      assistant_code = excluded.assistant_code,
      submission_id = excluded.submission_id,
      released = excluded.released,
      graded_by = auth.uid(),
      updated_at = now();
    saved := saved + 1;
  end loop;
  return saved;
end;
$$;

revoke all on function public.staff_upsert_grade_entries(jsonb) from public, anon;
grant execute on function public.staff_upsert_grade_entries(jsonb) to authenticated;

create or replace function public.admin_delete_student_account(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  if not exists (select 1 from public.profiles where id = target_id and role = 'student') then
    raise exception 'Only student accounts can be deleted here';
  end if;
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.admin_delete_student_account(uuid) from public, anon;
grant execute on function public.admin_delete_student_account(uuid) to authenticated;

drop function if exists public.staff_record_attendance_batch(jsonb);

create function public.staff_record_attendance_batch(entries jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  saved integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;
  for item in select value from jsonb_array_elements(entries)
  loop
    perform public.staff_record_attendance(
      (item->>'student_id')::uuid,
      item->>'track',
      (item->>'module_number')::integer,
      (item->>'week_number')::integer,
      (item->>'attended_at')::timestamptz,
      nullif(item->>'qna_score', '')::numeric,
      coalesce((item->>'is_makeup')::boolean, false),
      nullif(item->>'notes', '')
    );
    saved := saved + 1;
  end loop;
  return saved;
end;
$$;

revoke all on function public.staff_record_attendance_batch(jsonb) from public, anon;
grant execute on function public.staff_record_attendance_batch(jsonb) to authenticated;
