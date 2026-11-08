create table public.solve_daily_user_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count between 0 and 50),
  primary key (user_id, usage_date)
);

create table public.solve_daily_global_usage (
  usage_date date primary key,
  request_count integer not null default 0 check (request_count between 0 and 100)
);

alter table public.solve_daily_user_usage enable row level security;
alter table public.solve_daily_global_usage enable row level security;

revoke all on public.solve_daily_user_usage from anon, authenticated;
revoke all on public.solve_daily_global_usage from anon, authenticated;

create or replace function public.consume_solve_quota()
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  quota_date date := (statement_timestamp() at time zone 'UTC')::date;
  user_count integer;
  global_count integer;
  seconds_until_reset integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mathsnap.solve.daily:' || quota_date::text, 0)
  );

  select coalesce((
    select request_count
    from public.solve_daily_user_usage
    where user_id = current_user_id and usage_date = quota_date
  ), 0) into user_count;

  select coalesce((
    select request_count
    from public.solve_daily_global_usage
    where usage_date = quota_date
  ), 0) into global_count;

  if user_count >= 50 or global_count >= 100 then
    seconds_until_reset := greatest(
      1,
      ceil(extract(epoch from (
        ((quota_date + 1)::timestamp at time zone 'UTC') - statement_timestamp()
      )))::integer
    );
    return query select false, seconds_until_reset;
    return;
  end if;

  insert into public.solve_daily_user_usage (user_id, usage_date, request_count)
  values (current_user_id, quota_date, user_count + 1)
  on conflict (user_id, usage_date)
  do update set request_count = excluded.request_count;

  insert into public.solve_daily_global_usage (usage_date, request_count)
  values (quota_date, global_count + 1)
  on conflict (usage_date)
  do update set request_count = excluded.request_count;

  return query select true, 0;
end;
$$;

revoke all on function public.consume_solve_quota() from public, anon;
grant execute on function public.consume_solve_quota() to authenticated;
