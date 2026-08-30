update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array['application/pdf']::text[]
where id = 'practicum-reports';

drop policy if exists "students upload own reports" on storage.objects;
create policy "students upload own reports" on storage.objects for insert to authenticated
with check (
  bucket_id = 'practicum-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((metadata->>'mimetype'), '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 31457280
);

drop policy if exists "students replace own reports" on storage.objects;
create policy "students replace own reports" on storage.objects for update to authenticated
using (
  bucket_id = 'practicum-reports'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
)
with check (
  bucket_id = 'practicum-reports'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
  and coalesce((metadata->>'mimetype'), '') = 'application/pdf'
  and coalesce((metadata->>'size')::bigint, 0) <= 31457280
);

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

  if assigned.deadline_at is null then
    raise exception 'This assignment does not have an active deadline';
  end if;

  if new.status = 'uploading' and now() > assigned.deadline_at + interval '5 minutes' then
    raise exception 'This deadline has closed (WIB)';
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
