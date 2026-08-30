alter table public.student_module_plans
  add column if not exists planned_start_time time not null default time '15:00';

comment on column public.student_module_plans.planned_start_time is
  'Reference start time for this individual student assignment. It does not control submission access.';
