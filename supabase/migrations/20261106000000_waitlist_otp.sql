-- Email code (OTP) verification for the waitlist.
-- After this migration only the server (service role) can write to the waitlist.
-- Nobody can join without proving they can read the parent email inbox.

create table public.waitlist_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  role text not null check (role in ('parent', 'tutor')),
  grade smallint not null,
  instrument text not null,
  county text,
  code_hash text not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index waitlist_otps_lookup_idx on public.waitlist_otps (email, role, instrument, created_at desc);
alter table public.waitlist_otps enable row level security;
revoke all on public.waitlist_otps from anon, authenticated;

-- Step 1: store a hashed code. Limits: 1 per 45 seconds and 5 per hour for each email.
create function public.waitlist_otp_create(
  p_email text, p_role text, p_grade int, p_instrument text, p_county text, p_code_hash text,
  p_ttl interval default '10 minutes'
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare last_at timestamptz; n int;
begin
  select max(created_at), count(*) into last_at, n
    from public.waitlist_otps
    where email = p_email and created_at > now() - interval '1 hour';
  if last_at is not null and last_at > now() - interval '45 seconds' then return 'cooldown'; end if;
  if n >= 5 then return 'too_many'; end if;
  insert into public.waitlist_otps (email, role, grade, instrument, county, code_hash, expires_at)
    values (p_email, p_role, p_grade, p_instrument, p_county, p_code_hash, now() + p_ttl);
  return 'ok';
end;
$$;

-- Step 2: check the code. Five wrong tries lock that code. On success, add the signup.
create function public.waitlist_otp_verify(p_email text, p_role text, p_instrument text, p_code_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare o public.waitlist_otps%rowtype;
begin
  select * into o from public.waitlist_otps
    where email = p_email and role = p_role and instrument = p_instrument and expires_at > now()
    order by created_at desc limit 1
    for update;
  if not found then return 'expired'; end if;
  if o.attempts >= 5 then return 'locked'; end if;
  if o.code_hash <> p_code_hash then
    update public.waitlist_otps set attempts = attempts + 1 where id = o.id;
    return 'wrong';
  end if;
  insert into public.waitlist_signups (role, email, grade, instrument, county)
    values (o.role, o.email, o.grade, o.instrument, o.county)
    on conflict (email, instrument, role) do nothing;
  delete from public.waitlist_otps where email = o.email and role = o.role and instrument = o.instrument;
  return 'ok';
end;
$$;

-- Lock everything to the server. The public key can no longer insert or call these.
drop policy if exists "anon can join the waitlist" on public.waitlist_signups;
revoke insert (role, email, grade, instrument, county) on public.waitlist_signups from anon;

revoke all on function public.waitlist_otp_create(text, text, int, text, text, text, interval) from public, anon, authenticated;
revoke all on function public.waitlist_otp_verify(text, text, text, text) from public, anon, authenticated;
revoke all on function public.waitlist_rate_ok(text, int, interval) from public, anon, authenticated;
revoke all on function public.waitlist_count(text) from public, anon, authenticated;
grant execute on function public.waitlist_otp_create(text, text, int, text, text, text, interval) to service_role;
grant execute on function public.waitlist_otp_verify(text, text, text, text) to service_role;
grant execute on function public.waitlist_rate_ok(text, int, interval) to service_role;
grant execute on function public.waitlist_count(text) to service_role;

-- Daily cleanup now also removes expired codes.
select cron.schedule(
  'waitlist-cleanup',
  '17 4 * * *',
  $job$
    delete from public.waitlist_signups where notified_at is not null and notified_at < now() - interval '30 days';
    delete from public.waitlist_hits where hit_at < now() - interval '1 day';
    delete from public.waitlist_otps where expires_at < now() - interval '1 day';
  $job$
);
