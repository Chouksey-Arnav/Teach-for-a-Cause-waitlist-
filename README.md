# Teach for a Cause waitlist

A standalone Next.js (App Router) + Tailwind waitlist page with a Supabase backend. It is its own project and its own link, separate from the main site.

## What is in here
- `app/page.tsx` the landing page (nav, hero with form, instruments, how it works, safety, tutors, FAQ, footer)
- `components/WaitlistForm.tsx` the form and success screen
- `app/api/waitlist/route.ts` validation (zod), honeypot, IP rate limit, insert, optional real count
- `supabase/migrations/20261105000000_waitlist.sql` tables, RLS, helper functions, 30 day cleanup job

## Environment variables
Set these in `.env.local` and in Vercel (Project Settings, Environment Variables). See `.env.example`.
| Name | What it is |
|---|---|
| SUPABASE_URL | Your project URL |
| SUPABASE_PUBLISHABLE_KEY | The publishable (anon) key. Safe to use because every write goes through RLS |
| RATE_LIMIT_SALT | Any long random string. IPs are hashed with it, raw IPs are never stored |
| WAITLIST_SHOW_COUNTS | `true` to show a real count of waiting families on the parent success screen |
| NEXT_PUBLIC_SITE_URL | Your deployed URL, for Open Graph links |

## Run locally
```
npm install
npm run dev
```
Open http://localhost:3000. Fill the form, then check the `waitlist_signups` table in the Supabase dashboard.

Test the API directly:
```
# Should return field errors
curl -s -XPOST localhost:3000/api/waitlist -H 'content-type: application/json' \
  -d '{"role":"parent","email":"nope","grade":"9","instrument":"Kazoo"}'

# Should save one row (run it twice, you still get one row)
curl -s -XPOST localhost:3000/api/waitlist -H 'content-type: application/json' \
  -d '{"role":"parent","email":"Test@Example.com","grade":"7","instrument":"Flute","county":"Wake"}'

# Honeypot, returns ok and saves nothing
curl -s -XPOST localhost:3000/api/waitlist -H 'content-type: application/json' -d '{"company":"bot"}'
```
The sixth request from one IP inside an hour returns a 429 (limit is 5 per hour, change it in `waitlist_rate_ok`).

## Deploy
Push to GitHub, import into Vercel, add the env vars, deploy. Put a real Open Graph URL in NEXT_PUBLIC_SITE_URL after you know the domain.

## Notifying people later
When you email a group, set `status = 'notified'` and `notified_at = now()` for those rows (SQL editor or service role). The daily job deletes rows 30 days after `notified_at`.
