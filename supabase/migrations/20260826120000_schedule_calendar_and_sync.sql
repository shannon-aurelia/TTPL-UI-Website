alter table public.practicum_sessions
  add column if not exists sync_managed boolean not null default false;

alter table public.student_module_plans
  add column if not exists planned_lab_date date;

create index if not exists practicum_sessions_sync_managed_idx
  on public.practicum_sessions(sync_managed, source_row_key);

create index if not exists student_module_plans_planned_lab_date_idx
  on public.student_module_plans(planned_lab_date);

create or replace function public.staff_record_attendance_batch(entries jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  saved integer := 0;
  selected_module integer;
  group_id text;
  group_label text;
  attended_time timestamptz;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  for item in select * from jsonb_array_elements(entries)
  loop
    selected_module := (item->>'module_number')::integer;
    attended_time := (item->>'attended_at')::timestamptz;
    if (item->>'track') = 'rl' and selected_module in (2, 3) then group_id := 'rl-2-3'; group_label := 'Modules 2&3 Combined Report';
    elsif (item->>'track') = 'rl' and selected_module in (4, 5) then group_id := 'rl-4-5'; group_label := 'Modules 4&5 Combined Report';
    else group_id := (item->>'track') || '-' || selected_module; group_label := upper(item->>'track') || ' Module ' || selected_module || ' Report'; end if;

    insert into public.practicum_sessions (
      source_row_key, student_id, week_number, track, module_number, report_group,
      report_label, scheduled_at, attendance_status, attended_at, is_makeup,
      submission_open, deadline_at, qna_score, notes, sync_managed, sheet_updated_at
    ) values (
      item->>'source_row_key', (item->>'student_id')::uuid, (item->>'week_number')::integer,
      item->>'track', selected_module, group_id, group_label, attended_time, 'on_time',
      attended_time, coalesce((item->>'is_makeup')::boolean, false), selected_module <> 1,
      case when selected_module = 1 then null else ((attended_time at time zone 'Asia/Jakarta')::date + 1 + time '23:59') at time zone 'Asia/Jakarta' end,
      nullif(item->>'qna_score', '')::numeric, nullif(item->>'notes', ''), true, now()
    )
    on conflict (source_row_key) do update set
      qna_score = excluded.qna_score,
      notes = excluded.notes,
      is_makeup = excluded.is_makeup,
      attended_at = excluded.attended_at,
      scheduled_at = excluded.scheduled_at,
      submission_open = excluded.submission_open,
      deadline_at = excluded.deadline_at,
      sync_managed = true,
      sheet_updated_at = now(),
      updated_at = now();
    saved := saved + 1;
  end loop;
  return saved;
end;
$$;

revoke all on function public.staff_record_attendance_batch(jsonb) from public, anon;
grant execute on function public.staff_record_attendance_batch(jsonb) to authenticated;
