-- =====================================================================
-- Teach for a Cause — Supabase Admin Queries
-- =====================================================================
-- HOW TO RUN THESE QUERIES IN SUPABASE:
-- 1. Log in to your Supabase dashboard: https://supabase.com/dashboard
-- 2. Select your project ("Teach for a Cause waitlist").
-- 3. Click on the "SQL Editor" icon in the left navigation sidebar.
-- 4. Click "+ New query" (or open an existing query tab).
-- 5. Copy and paste any of the query blocks below, and click "Run".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERFORMANCE INDEXES (Run once if not already created)
-- ---------------------------------------------------------------------
-- Ensures fast sorting and instant admin dashboard loading
create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

create index if not exists waitlist_otps_created_at_idx
  on public.waitlist_otps (created_at desc);


-- ---------------------------------------------------------------------
-- 2. VIEW ALL VERIFIED WAITLIST SIGNUPS
-- ---------------------------------------------------------------------
-- View all verified signups, most recent first
select
  id,
  role,
  email,
  grade,
  instrument,
  county,
  status,
  created_at,
  notified_at
from public.waitlist_signups
order by created_at desc;


-- ---------------------------------------------------------------------
-- 3. SUMMARY COUNTS & DASHBOARD METRICS
-- ---------------------------------------------------------------------
-- Total signups, middle school students, high school tutors, and statuses
select
  count(*) as total_signups,
  count(*) filter (where role = 'parent') as middle_school_students,
  count(*) filter (where role = 'tutor') as high_school_tutors,
  count(*) filter (where status = 'waiting') as status_waiting,
  count(*) filter (where status = 'notified') as status_notified
from public.waitlist_signups;


-- ---------------------------------------------------------------------
-- 4. BREAKDOWN BY INSTRUMENT
-- ---------------------------------------------------------------------
-- Counts of students and tutors per instrument
select
  instrument,
  count(*) as total,
  count(*) filter (where role = 'parent') as students,
  count(*) filter (where role = 'tutor') as tutors,
  count(*) filter (where status = 'waiting') as waiting
from public.waitlist_signups
group by instrument
order by total desc, instrument asc;


-- ---------------------------------------------------------------------
-- 5. BREAKDOWN BY COUNTY / REGION
-- ---------------------------------------------------------------------
-- Geographic distribution across North Carolina counties
select
  coalesce(county, 'Not Specified') as county,
  count(*) as total_signups,
  count(*) filter (where role = 'parent') as students,
  count(*) filter (where role = 'tutor') as tutors
from public.waitlist_signups
group by county
order by total_signups desc;


-- ---------------------------------------------------------------------
-- 6. VIEW PENDING / IN-PROGRESS EMAIL CODE (OTP) VERIFICATIONS
-- ---------------------------------------------------------------------
-- Shows active verification codes sent via email that haven't been completed yet
select
  id,
  email,
  role,
  grade,
  instrument,
  county,
  attempts,
  expires_at,
  created_at,
  case
    when attempts >= 5 then 'locked'
    when expires_at < now() then 'expired'
    else 'active'
  end as otp_status
from public.waitlist_otps
order by created_at desc
limit 50;


-- ---------------------------------------------------------------------
-- 7. RECENT RATE LIMIT ACTIVITY (Salted IP Hashes)
-- ---------------------------------------------------------------------
-- View recent submission rate activity (no raw IPs are stored)
select
  id,
  ip_hash,
  hit_at
from public.waitlist_hits
order by hit_at desc
limit 50;


-- ---------------------------------------------------------------------
-- 8. MANAGEMENT: MARK A SIGNUP AS NOTIFIED
-- ---------------------------------------------------------------------
-- Replace 'USER_EMAIL_HERE' with the target email address
-- update public.waitlist_signups
-- set status = 'notified', notified_at = now()
-- where email = 'USER_EMAIL_HERE';


-- ---------------------------------------------------------------------
-- 9. MANAGEMENT: REVERT A SIGNUP BACK TO WAITING
-- ---------------------------------------------------------------------
-- update public.waitlist_signups
-- set status = 'waiting', notified_at = null
-- where email = 'USER_EMAIL_HERE';


-- ---------------------------------------------------------------------
-- 10. CLEANUP / TESTING: DELETE SPECIFIC TEST RECORD
-- ---------------------------------------------------------------------
-- delete from public.waitlist_signups
-- where email = 'test@example.com';
