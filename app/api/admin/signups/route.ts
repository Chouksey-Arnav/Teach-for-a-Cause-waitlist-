import { NextResponse } from "next/server";
import { adminClient, fail, NOT_SET_UP, SERVER_ERROR } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAdminAuth(req: Request): boolean {
  const secretKey = process.env.ADMIN_SECRET_KEY;
  if (!secretKey) {
    // If no secret key is set in environment, allow access in development/beta
    return true;
  }
  const authHeader = req.headers.get("x-admin-key") || req.headers.get("authorization");
  if (!authHeader) return false;
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  return provided === secretKey;
}

// GET: Fetch all waitlist signups with real-time statistics
export async function GET(req: Request) {
  if (!checkAdminAuth(req)) {
    return fail(401, "Unauthorized: Invalid or missing admin key.");
  }

  const supabase = adminClient();
  if (!supabase) {
    return fail(500, NOT_SET_UP);
  }

  const { data: signups, error } = await supabase
    .from("waitlist_signups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching signups:", error);
    return fail(500, SERVER_ERROR);
  }

  return NextResponse.json({
    ok: true,
    signups: signups ?? [],
    fetchedAt: new Date().toISOString(),
  });
}

// PATCH: Update signup status (e.g., mark as 'notified' or back to 'waiting')
export async function PATCH(req: Request) {
  if (!checkAdminAuth(req)) {
    return fail(401, "Unauthorized: Invalid or missing admin key.");
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
    return fail(401, "Unauthorized: Invalid or missing admin key.");
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
