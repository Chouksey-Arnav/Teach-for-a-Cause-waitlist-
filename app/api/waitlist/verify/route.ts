import { NextResponse } from "next/server";
import { verifySchema } from "@/lib/schema";
import { adminClient, ipHash, fail, NOT_SET_UP, SERVER_ERROR } from "@/lib/server";
import { hashCode } from "@/lib/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Something went wrong with that request. Please try again.");
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return fail(422, "Enter the 6 digit code from the email.", fields);
  }
  const d = parsed.data;

  const supabase = adminClient();
  if (!supabase || !process.env.OTP_SECRET) return fail(500, NOT_SET_UP);

  const { data: allowed, error: rateError } = await supabase.rpc("waitlist_rate_ok", {
    p_ip_hash: ipHash(req, "verify"),
    p_limit: 20,
  });
  if (rateError) return fail(500, SERVER_ERROR);
  if (allowed === false) return fail(429, "Too many tries from this connection. Please wait an hour and try again.");

  const { data: result, error } = await supabase.rpc("waitlist_otp_verify", {
    p_email: d.email,
    p_role: d.role,
    p_instrument: d.instrument,
    p_code_hash: hashCode(d.email, d.role, d.instrument, d.code),
  });
  if (error) return fail(500, SERVER_ERROR);
  if (result === "wrong") return fail(400, "That code doesn’t match. Check the email and try again.");
  if (result === "locked") return fail(429, "Too many wrong tries for that code. Send a new code and try again.");
  if (result === "expired") return fail(410, "That code expired or wasn’t found. Send a new code.");
  if (result !== "ok") return fail(500, SERVER_ERROR);

  let count: number | null = null;
  if (d.role === "parent" && process.env.WAITLIST_SHOW_COUNTS === "true") {
    const { data } = await supabase.rpc("waitlist_count", { p_instrument: d.instrument });
    if (typeof data === "number") count = data;
  }
  return NextResponse.json({ ok: true, role: d.role, instrument: d.instrument, count });
}
