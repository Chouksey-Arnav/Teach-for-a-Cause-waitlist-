import { NextResponse } from "next/server";
import { adminClient, fail, NOT_SET_UP, SERVER_ERROR } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function checkAdminAuth(req: Request): boolean {
  // Use ADMIN_PASSWORD as primary env var, fallback to ADMIN_SECRET_KEY
  const expectedPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET_KEY;
  if (!expectedPassword) {
    // If no password is set in environment, allow access
    return true;
  }
  const authHeader =
    req.headers.get("x-admin-password") ||
    req.headers.get("x-admin-key") ||
    req.headers.get("authorization");
  if (!authHeader) return false;
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  return provided === expectedPassword;
}

// GET: Fetch all waitlist signups and pending OTP verification sessions
export async function GET(req: Request) {
  if (!checkAdminAuth(req)) {
    return fail(401, "Unauthorized: Invalid or missing password.");
  }

  const supabase = adminClient();
  if (!supabase) {
    return fail(500, NOT_SET_UP);
  }

  const [signupsRes, otpsRes] = await Promise.all([
    supabase
      .from("waitlist_signups")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("waitlist_otps")
      .select("id, email, role, grade, instrument, county, attempts, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (signupsRes.error) {
    console.error("Error fetching signups:", signupsRes.error);
    return fail(500, SERVER_ERROR);
  }

  return NextResponse.json(
    {
      ok: true,
      signups: signupsRes.data ?? [],
      otps: otpsRes.data ?? [],
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

// PATCH: Update signup status (e.g., mark as 'notified' or back to 'waiting')
export async function PATCH(req: Request) {
  if (!checkAdminAuth(req)) {
    return fail(401, "Unauthorized: Invalid or missing password.");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const { id, status } = body;
  if (typeof id !== "string" || !["waiting", "notified"].includes(String(status))) {
    return fail(422, "Valid 'id' and 'status' ('waiting' or 'notified') are required.");
  }

  const supabase = adminClient();
  if (!supabase) return fail(500, NOT_SET_UP);

  const updatePayload: { status: string; notified_at: string | null } = {
    status: String(status),
    notified_at: status === "notified" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("waitlist_signups")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating signup:", error);
    return fail(500, SERVER_ERROR);
  }

  return NextResponse.json({ ok: true, signup: data });
}

// DELETE: Remove a signup record
export async function DELETE(req: Request) {
  if (!checkAdminAuth(req)) {
    return fail(401, "Unauthorized: Invalid or missing password.");
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return fail(422, "Missing 'id' query parameter.");
  }

  const supabase = adminClient();
  if (!supabase) return fail(500, NOT_SET_UP);

  const { error } = await supabase
    .from("waitlist_signups")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting signup:", error);
    return fail(500, SERVER_ERROR);
  }

  return NextResponse.json({ ok: true, id });
}
