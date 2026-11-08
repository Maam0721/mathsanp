create extension if not exists pgcrypto;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create unique index if not exists topics_user_name_unique
  on public.topics (user_id, lower(name));

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  image_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists problems_user_topic_created_idx
  on public.problems (user_id, topic_id, created_at desc);

create table if not exists public.solutions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null unique references public.problems(id) on delete cascade,
  content text not null,
  model text not null,
  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;
alter table public.problems enable row level security;
alter table public.solutions enable row level security;

create policy "Users manage their own topics"
  on public.topics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own problems"
  on public.problems for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.topics
      where topics.id = problems.topic_id and topics.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.topics
      where topics.id = problems.topic_id and topics.user_id = auth.uid()
    )
  );

create policy "Users read solutions for their problems"
  on public.solutions for select
  using (
    exists (
      select 1 from public.problems
      where problems.id = solutions.problem_id and problems.user_id = auth.uid()
    )
  );

create policy "Users create solutions for their problems"
  on public.solutions for insert
  with check (
    exists (
      select 1 from public.problems
      where problems.id = solutions.problem_id and problems.user_id = auth.uid()
    )
  );

create policy "Users update solutions for their problems"
  on public.solutions for update
  using (
    exists (
      select 1 from public.problems
      where problems.id = solutions.problem_id and problems.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.problems
      where problems.id = solutions.problem_id and problems.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('problems', 'problems', false, 10485760, array['image/png', 'image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg'];

create policy "Users access files in their own folder"
  on storage.objects for select
  using (
    bucket_id = 'problems'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users upload files in their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'problems'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update files in their own folder"
  on storage.objects for update
  using (
    bucket_id = 'problems'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'problems'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete files in their own folder"
  on storage.objects for delete
  using (
    bucket_id = 'problems'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
