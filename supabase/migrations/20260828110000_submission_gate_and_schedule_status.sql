alter table public.student_module_plans
  add column if not exists approved_reason text;

alter table public.student_module_plans
  drop constraint if exists student_module_plans_status_check;

alter table public.student_module_plans
  add constraint student_module_plans_status_check
  check (status in ('expected','rescheduled','deferred','completed'));

alter table public.student_module_plans
  drop constraint if exists student_module_plans_approved_reason_check;

alter table public.student_module_plans
  add constraint student_module_plans_approved_reason_check
  check (approved_reason is null or approved_reason in ('sick','death','competition','force_majeure'));

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
  score_value numeric;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  for item in select * from jsonb_array_elements(entries)
  loop
    selected_module := (item->>'module_number')::integer;
    attended_time := (item->>'attended_at')::timestamptz;
    score_value := nullif(item->>'qna_score', '')::numeric;
    if (item->>'track') = 'rl' and selected_module in (2, 3) then group_id := 'rl-2-3'; group_label := 'RL Module 2&3 Report';
    elsif (item->>'track') = 'rl' and selected_module in (4, 5) then group_id := 'rl-4-5'; group_label := 'RL Module 4&5 Report';
    else group_id := (item->>'track') || '-' || selected_module; group_label := upper(item->>'track') || ' Module ' || selected_module || ' Report'; end if;

    insert into public.practicum_sessions (
      source_row_key, student_id, week_number, track, module_number, report_group,
      report_label, scheduled_at, attendance_status, attended_at, is_makeup,
      submission_open, deadline_at, qna_score, notes, sync_managed, sheet_updated_at
    ) values (
      item->>'source_row_key', (item->>'student_id')::uuid, (item->>'week_number')::integer,
      item->>'track', selected_module, group_id, group_label, attended_time, 'on_time',
      attended_time, coalesce((item->>'is_makeup')::boolean, false), selected_module <> 1 and score_value is not null,
      case when selected_module = 1 then null else ((attended_time at time zone 'Asia/Jakarta')::date + 1 + time '23:59') at time zone 'Asia/Jakarta' end,
      score_value, nullif(item->>'notes', ''), true, now()
    )
    on conflict (source_row_key) do update set
      qna_score = excluded.qna_score, notes = excluded.notes, is_makeup = excluded.is_makeup,
      attended_at = excluded.attended_at, scheduled_at = excluded.scheduled_at,
      submission_open = excluded.submission_open, deadline_at = excluded.deadline_at,
      sync_managed = true, sheet_updated_at = now(), updated_at = now();
    saved := saved + 1;
  end loop;
  return saved;
end;
$$;

revoke all on function public.staff_record_attendance_batch(jsonb) from public, anon;
grant execute on function public.staff_record_attendance_batch(jsonb) to authenticated;
