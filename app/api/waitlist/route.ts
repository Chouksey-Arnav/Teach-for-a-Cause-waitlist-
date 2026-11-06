import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { signupSchema } from "@/lib/schema";

export const runtime = "nodejs";

const fail = (status: number, error: string, fields?: Record<string, string>) =>
  NextResponse.json({ error, fields }, { status });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Something went wrong with that request. Please try again.");
  }

  // Honeypot. Real people never see this field. Pretend it worked.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return fail(422, "Please fix the fields marked below.", fields);
  }
  const d = parsed.data;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail(500, "The list is not set up yet. Please email chouksey.arnav@gmail.com.");
  // Anon key on purpose, so every write goes through row level security.
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  const ipHash = createHash("sha256").update(ip + (process.env.RATE_LIMIT_SALT ?? "")).digest("hex");
  const { data: allowed, error: rateError } = await supabase.rpc("waitlist_rate_ok", { p_ip_hash: ipHash });
  if (rateError) return fail(500, "Something went wrong on our side. Please try again in a minute.");
  if (allowed === false) return fail(429, "Too many tries from this connection. Please wait an hour and try again.");

  const { error } = await supabase
    .from("waitlist_signups")
    .insert({ role: d.role, email: d.email, grade: d.grade, instrument: d.instrument, county: d.county });
  // 23505 means this email is already on the list for this instrument and role. Treat it as done.
  if (error && error.code !== "23505") {
    return fail(500, "Something went wrong on our side. Please try again in a minute.");
  }

  let count: number | null = null;
  if (d.role === "parent" && process.env.WAITLIST_SHOW_COUNTS === "true") {
    const { data } = await supabase.rpc("waitlist_count", { p_instrument: d.instrument });
    if (typeof data === "number") count = data;
  }
  return NextResponse.json({ ok: true, role: d.role, instrument: d.instrument, count });
}
