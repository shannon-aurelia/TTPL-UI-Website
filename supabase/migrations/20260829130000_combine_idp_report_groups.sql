update public.practicum_sessions
set
  report_group = case
    when module_number in (2, 3) then 'idp-2-3'
    when module_number in (4, 5) then 'idp-4-5'
    else report_group
  end,
  report_label = case
    when module_number in (2, 3) then 'IDP Module 2&3 Report'
    when module_number in (4, 5) then 'IDP Module 4&5 Report'
    else report_label
  end,
  updated_at = now()
where track = 'idp' and module_number in (2, 3, 4, 5);

update public.student_module_plans
set
  report_group = case
    when module_number in (2, 3) then 'idp-2-3'
    when module_number in (4, 5) then 'idp-4-5'
    else report_group
  end,
  report_label = case
    when module_number in (2, 3) then 'IDP Module 2&3 Report'
    when module_number in (4, 5) then 'IDP Module 4&5 Report'
    else report_label
  end,
  updated_at = now()
where track = 'idp' and module_number in (2, 3, 4, 5);

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
    if (item->>'track') in ('rl', 'idp') and selected_module in (2, 3) then
      group_id := (item->>'track') || '-2-3';
      group_label := upper(item->>'track') || ' Module 2&3 Report';
    elsif (item->>'track') in ('rl', 'idp') and selected_module in (4, 5) then
      group_id := (item->>'track') || '-4-5';
      group_label := upper(item->>'track') || ' Module 4&5 Report';
    else
      group_id := (item->>'track') || '-' || selected_module;
      group_label := upper(item->>'track') || ' Module ' || selected_module || ' Report';
    end if;

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
      qna_score = excluded.qna_score,
      notes = excluded.notes,
      is_makeup = excluded.is_makeup,
      attended_at = excluded.attended_at,
      scheduled_at = excluded.scheduled_at,
      report_group = excluded.report_group,
      report_label = excluded.report_label,
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
