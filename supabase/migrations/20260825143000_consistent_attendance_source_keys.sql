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
  saved_session_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  for item in select value from jsonb_array_elements(entries)
  loop
    saved_session_id := public.staff_record_attendance(
      (item->>'student_id')::uuid,
      item->>'track',
      (item->>'module_number')::integer,
      (item->>'week_number')::integer,
      (item->>'attended_at')::timestamptz,
      nullif(item->>'qna_score', '')::numeric,
      coalesce((item->>'is_makeup')::boolean, false),
      nullif(item->>'notes', '')
    );

    if nullif(item->>'source_row_key', '') is not null then
      update public.practicum_sessions
      set source_row_key = item->>'source_row_key'
      where id = saved_session_id;
    end if;
    saved := saved + 1;
  end loop;

  return saved;
end;
$$;

revoke all on function public.staff_record_attendance_batch(jsonb) from public, anon;
grant execute on function public.staff_record_attendance_batch(jsonb) to authenticated;
