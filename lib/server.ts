import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // Service role key. Server only. Never expose it to the browser.
  return createClient(url, key, { auth: { persistSession: false } });
}

export function ipHash(req: Request, scope: string) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  return createHash("sha256").update(`${scope}:${ip}:${process.env.RATE_LIMIT_SALT ?? ""}`).digest("hex");
}

export const fail = (status: number, error: string, fields?: Record<string, string>) =>
  NextResponse.json({ error, fields }, { status });

export const NOT_SET_UP = "The list is not set up yet. Please email chouksey.arnav@gmail.com.";
export const SERVER_ERROR = "Something went wrong on our side. Please try again in a minute.";
