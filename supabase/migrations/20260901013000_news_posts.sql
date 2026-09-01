create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  content text not null check (char_length(content) between 1 and 5000),
  tag text not null default 'Announcement' check (char_length(tag) between 1 and 40),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news_posts enable row level security;
drop policy if exists "public read news" on public.news_posts;
create policy "public read news" on public.news_posts for select using (true);
drop policy if exists "staff create news" on public.news_posts;
create policy "staff create news" on public.news_posts for insert to authenticated with check (public.is_staff() and author_id = auth.uid());
drop policy if exists "staff update news" on public.news_posts;
create policy "staff update news" on public.news_posts for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff delete news" on public.news_posts;
create policy "staff delete news" on public.news_posts for delete to authenticated using (public.is_staff());
grant select on public.news_posts to anon, authenticated;
grant insert, update, delete on public.news_posts to authenticated;

insert into public.news_posts (title, content, tag)
select seed.title, seed.content, seed.tag
from (values
  ('The seal is broken.', 'Six new names begin a new TTPL chapter as the batch 2024 active assistants.', 'Announcement'),
  ('RL and IDP semester timeline.', 'RL begins with the September pre-test and IDP continues through November and December.', 'Practicum'),
  ('TTPL YouTube hub.', 'Official practicum videos remain connected to the TTPL FTUI YouTube channel.', 'Resource'),
  ('Digital practicum platform.', 'Personalized schedules, report submissions, and assistant review tools are being prepared for real deployment.', 'Platform')
) as seed(title, content, tag)
where not exists (select 1 from public.news_posts);
