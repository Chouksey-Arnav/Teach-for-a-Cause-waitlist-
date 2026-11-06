import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/schema";
import { adminClient, ipHash, fail, NOT_SET_UP, SERVER_ERROR } from "@/lib/server";
import { makeCode, hashCode } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const supabase = adminClient();
  if (!supabase || !process.env.OTP_SECRET || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return fail(500, NOT_SET_UP);
  }

  const { data: allowed, error: rateError } = await supabase.rpc("waitlist_rate_ok", {
    p_ip_hash: ipHash(req, "start"),
    p_limit: 8,
  });
  if (rateError) return fail(500, SERVER_ERROR);
  if (allowed === false) return fail(429, "Too many tries from this connection. Please wait an hour and try again.");

  const code = makeCode();
  const { data: result, error } = await supabase.rpc("waitlist_otp_create", {
    p_email: d.email,
    p_role: d.role,
    p_grade: d.grade,
    p_instrument: d.instrument,
    p_county: d.county,
    p_code_hash: hashCode(d.email, d.role, d.instrument, code),
  });
  if (error) return fail(500, SERVER_ERROR);
  if (result === "cooldown") return fail(429, "Please wait about a minute before asking for another code.");
  if (result === "too_many") return fail(429, "Too many codes for this email. Please try again in an hour.");
  if (result !== "ok") return fail(500, SERVER_ERROR);

  try {
    await sendOtpEmail(d.email, code);
  } catch (e) {
    console.error("OTP email failed", e);
    return fail(502, "We couldn’t send the email. Check the address and try again, or email chouksey.arnav@gmail.com.");
  }
  return NextResponse.json({ ok: true });
}
