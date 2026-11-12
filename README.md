# Teach for a Cause waitlist

Standalone Next.js (App Router) + Tailwind waitlist with Supabase and email code (OTP) verification sent through Gmail with Nodemailer.

## How joining works
1. Someone fills the form. `POST /api/waitlist/start` checks it, rate limits by IP, stores a hashed 6 digit code, and emails the code.
2. They type the code. `POST /api/waitlist/verify` checks it. Five wrong tries lock that code, and codes expire after 10 minutes.
3. Only after a correct code does the row go into `waitlist_signups`.

All database writes happen on the server with the Supabase service role key. The public key has no access to the waitlist tables.

## Gmail setup
1. Use a Gmail account just for this. People will see its address as the sender.
2. Turn on 2 Step Verification: https://myaccount.google.com/security
3. Create an app password: https://myaccount.google.com/apppasswords (name it "TFAC waitlist"). Google shows 16 letters. Paste them as `GMAIL_APP_PASSWORD`. Spaces are fine, the code removes them.
4. Free Gmail allows roughly 500 emails a day. First emails from a new sender can land in spam, so the page tells people to check there.

## Environment variables (.env.local and Vercel)
See `.env.example`. Generate `OTP_SECRET` and `RATE_LIMIT_SALT` with `openssl rand -hex 32`. Get `SUPABASE_SERVICE_ROLE_KEY` from Supabase, Project Settings, API. Never use a NEXT_PUBLIC_ prefix on any of them except `NEXT_PUBLIC_SITE_URL`.

## Database
Run the files in `supabase/migrations` in order (waitlist, then waitlist_otp). A daily job removes rows 30 days after `notified_at` and clears expired codes.

## Supabase Admin Queries
All ready-to-run administrative queries are saved in `supabase/admin_queries.sql` so you can easily copy and paste them directly into Supabase.

### Where to navigate in Supabase:
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project (**Teach for a Cause waitlist**).
3. In the left navigation sidebar, click on **SQL Editor** (icon: `>_`).
4. Click **+ New query** in the top bar.
5. Open `supabase/admin_queries.sql` in this repo, copy whichever query block you need, paste it into the editor, and click **Run** (or `Ctrl+Enter` / `Cmd+Enter`).

Queries available in `supabase/admin_queries.sql`:
- **Performance indexes**: Speeds up admin dashboard queries and real-time polling.
- **View all signups**: Lists all verified registrations with roles, grades, instruments, emails, and statuses.
- **Summary statistics**: Live counts of middle school students, high school tutors, and waiting vs notified.
- **Breakdown by instrument**: See waitlist counts per musical instrument.
- **Breakdown by county**: Regional distribution across North Carolina counties.
- **Pending OTP sessions**: View active verification codes sent via email that haven't been completed yet.
- **Rate limit log**: Inspect recent hashed request activity.
- **Status updates & deletions**: SQL templates to mark rows as notified, revert to waiting, or delete test records.

## Admin Dashboard Access
The public links to the admin dashboard have been removed for confidentiality.
- **Direct link**: `/admin`
- **Discreet entry**: Click on the word `"district"` at the end of the footer disclaimer on the homepage (`Not affiliated with or endorsed by any school or school district.`).
- **Password Protection**: Set `ADMIN_PASSWORD` in your Vercel environment variables (or `.env.local` for local development). When set, the `/admin` portal will strictly require this password to access and view all waitlist and Supabase records.

## Run locally
```
npm install
npm run dev
```
Submit the form with an email you can read, enter the code, then check `waitlist_signups` in Supabase.

## Notifying people later
Set `status = 'notified'` and `notified_at = now()` on the rows you emailed.
