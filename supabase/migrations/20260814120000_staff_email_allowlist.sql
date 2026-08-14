create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.staff_email_allowlist (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('assistant', 'admin')),
  created_at timestamptz not null default now()
);

revoke all on private.staff_email_allowlist from public, anon, authenticated;

insert into private.staff_email_allowlist (email, role)
values
  ('naila.faiza41@ui.ac.id', 'admin'),
  ('alief.rizki41@ui.ac.id', 'admin'),
  ('dominick.dexter@ui.ac.id', 'admin'),
  ('dominickdexter06@gmail.com', 'admin'),
  ('iftikharus.raudana@ui.ac.id', 'admin'),
  ('raudana.muntazar@gmail.com', 'admin'),
  ('abdul.jafor@ui.ac.id', 'admin')
on conflict (email) do update set role = excluded.role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  clean_npm text;
  clean_name text;
  assigned_role text;
begin
  clean_npm := nullif(trim(coalesce(new.raw_user_meta_data->>'npm', '')), '');
  clean_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    split_part(new.email, '@', 1)
  );

  select coalesce(
    (select role from private.staff_email_allowlist where email = lower(new.email)),
    'student'
  )
  into assigned_role;

  begin
    insert into public.profiles (id, email, full_name, npm, role)
    values (new.id, lower(new.email), clean_name, clean_npm, assigned_role)
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      npm = coalesce(excluded.npm, public.profiles.npm),
      role = case
        when excluded.role in ('assistant', 'admin') then excluded.role
        else public.profiles.role
      end;
  exception when others then
    insert into public.profiles (id, email, full_name, npm, role)
    values (new.id, lower(new.email), clean_name, null, assigned_role)
    on conflict (id) do update set
      role = case
        when excluded.role in ('assistant', 'admin') then excluded.role
        else public.profiles.role
      end;
  end;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
