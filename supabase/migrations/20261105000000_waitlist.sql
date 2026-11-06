-- Teach for a Cause waitlist: signups, rate limit hits, RLS, helper functions, 30 day cleanup.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('parent', 'tutor')),
  email text not null check (email = lower(email) and length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  grade smallint not null,
  instrument text not null check (length(instrument) between 2 and 40),
  county text check (county is null or length(county) <= 40),
  status text not null default 'waiting' check (status in ('waiting', 'notified')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  constraint waitlist_grade_by_role check (
    (role = 'parent' and grade between 6 and 8) or (role = 'tutor' and grade between 9 and 12)
  ),
  constraint waitlist_unique_signup unique (email, instrument, role)
);

create index waitlist_signups_instrument_idx on public.waitlist_signups (instrument, role, status);
create index waitlist_signups_notified_idx on public.waitlist_signups (notified_at) where notified_at is not null;

-- Row level security: anonymous insert only, no public reads, updates or deletes.
alter table public.waitlist_signups enable row level security;
revoke all on public.waitlist_signups from anon, authenticated;
grant insert (role, email, grade, instrument, county) on public.waitlist_signups to anon;
create policy "anon can join the waitlist" on public.waitlist_signups
  for insert to anon
  with check (status = 'waiting' and notified_at is null);

-- Rate limit bookkeeping. Only stores a salted hash of the IP, never the IP itself.
create table public.waitlist_hits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  hit_at timestamptz not null default now()
);
create index waitlist_hits_lookup_idx on public.waitlist_hits (ip_hash, hit_at);
alter table public.waitlist_hits enable row level security;
revoke all on public.waitlist_hits from anon, authenticated;

create function public.waitlist_rate_ok(p_ip_hash text, p_limit int default 5, p_window interval default '1 hour')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64 then return false; end if;
  select count(*) into n from public.waitlist_hits
    where ip_hash = p_ip_hash and hit_at > now() - p_window;
  if n >= p_limit then return false; end if;
  insert into public.waitlist_hits (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

-- Returns only a number. Counts families (parent role) still waiting for one instrument.
create function public.waitlist_count(p_instrument text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.waitlist_signups
  where role = 'parent' and status = 'waiting' and instrument = p_instrument;
$$;

revoke all on function public.waitlist_rate_ok(text, int, interval) from public, anon, authenticated;
revoke all on function public.waitlist_count(text) from public, anon, authenticated;
grant execute on function public.waitlist_rate_ok(text, int, interval) to anon;
grant execute on function public.waitlist_count(text) to anon;

-- Daily cleanup: delete rows 30 days after the notification email, and old rate limit hits.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'waitlist-cleanup',
  '17 4 * * *',
  $job$
    delete from public.waitlist_signups where notified_at is not null and notified_at < now() - interval '30 days';
    delete from public.waitlist_hits where hit_at < now() - interval '1 day';
  $job$
);
