insert into private.staff_email_allowlist (email, role)
values ('shannonaureliaw@gmail.com', 'admin')
on conflict (email) do update set role = excluded.role;

create or replace function public.staff_record_attendance_batch(entries jsonb)
returns setof public.practicum_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  saved public.practicum_sessions;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  for item in select value from jsonb_array_elements(entries)
  loop
    select * into saved
    from public.staff_record_attendance(
      (item->>'student_id')::uuid,
      (item->>'week_number')::integer,
      item->>'track',
      (item->>'module_number')::integer,
      (item->>'scheduled_at')::timestamptz,
      coalesce(nullif(item->>'attendance_status', ''), 'on_time'),
      coalesce((item->>'is_makeup')::boolean, false),
      nullif(item->>'qna_score', '')::numeric,
      nullif(item->>'notes', '')
    );
    return next saved;
  end loop;
end;
$$;

revoke all on function public.staff_record_attendance_batch(jsonb) from public;
grant execute on function public.staff_record_attendance_batch(jsonb) to authenticated;
