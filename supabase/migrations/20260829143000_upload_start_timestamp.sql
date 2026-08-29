alter table public.submissions
  drop constraint if exists submissions_status_check;

alter table public.submissions
  add constraint submissions_status_check
  check (status in ('uploading','submitted','screening','ready_for_emas','uploaded_to_emas','failed'));

create or replace function public.secure_student_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned public.practicum_sessions%rowtype;
  official_time timestamptz;
begin
  if public.is_staff() then return new; end if;

  select * into assigned from public.practicum_sessions
  where id = new.session_id and student_id = auth.uid();

  if assigned.id is null or assigned.submission_open is not true
    or assigned.attendance_status not in ('on_time', 'late')
    or assigned.qna_score is null then
    raise exception 'This assignment is not open for submission';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.session_id is distinct from old.session_id
    or new.student_id is distinct from old.student_id
  ) then raise exception 'Submission ownership cannot be changed'; end if;

  new.student_id := auth.uid();
  new.track := assigned.track;
  new.report_group := assigned.report_group;
  new.week_number := assigned.week_number;
  official_time := case
    when new.status = 'uploading' then now()
    when tg_op = 'UPDATE' then old.submitted_at
    else now()
  end;
  new.submitted_at := official_time;
  new.minutes_late := case when assigned.deadline_at is null then 0
    else greatest(0, ceil(extract(epoch from (official_time - assigned.deadline_at)) / 60.0)::integer) end;
  new.late_penalty := least(100, new.minutes_late * 10);
  new.updated_at := now();

  if new.file_path not like (auth.uid()::text || '/%') then raise exception 'Invalid report storage path'; end if;
  return new;
end;
$$;

revoke execute on function public.secure_student_submission() from public, anon, authenticated;
