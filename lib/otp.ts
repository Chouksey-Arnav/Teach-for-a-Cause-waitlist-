import { createHmac, randomInt } from "crypto";

export const makeCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

// HMAC with a secret only the server knows, so a stored hash can't be turned back into a code.
export function hashCode(email: string, role: string, instrument: string, code: string) {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error("Missing OTP_SECRET");
  return createHmac("sha256", secret).update(`${email}|${role}|${instrument}|${code}`).digest("hex");
}
