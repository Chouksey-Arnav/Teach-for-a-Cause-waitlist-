"use client";
import { useEffect, useRef, useState } from "react";
import { INSTRUMENTS } from "@/lib/instruments";
import { COUNTIES } from "@/lib/counties";

type Role = "parent" | "tutor";
type Errors = Partial<Record<"role" | "email" | "grade" | "instrument" | "county" | "code" | "form", string>>;
type Pending = { role: Role; email: string; instrument: string; payload: Record<string, FormDataEntryValue> };
type Done = { role: Role; instrument: string; count: number | null };

const input = "h-12 w-full rounded-xl border border-line bg-bg px-3 text-base text-ink placeholder:text-muted";
const label = "mb-1.5 block text-sm font-medium text-ink";
const RESEND_SECONDS = 45;

export default function WaitlistForm() {
  const [role, setRole] = useState<Role>("parent");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [notice, setNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("role") === "tutor") setRole("tutor");
  }, []);
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);
  useEffect(() => { if (pending) codeRef.current?.focus(); }, [pending]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const grades = role === "parent" ? [6, 7, 8] : [9, 10, 11, 12];

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, data };
  }

  function showErrors(next: Errors) {
    setErrors(next);
    const first = (["email", "grade", "instrument", "county"] as const).find((k) => next[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  // Step 1: validate and email a code.
  async function sendCode(payload: Record<string, FormDataEntryValue>, isResend = false) {
    setBusy(true);
    setErrors({});
    setNotice("");
    try {
      const { ok, data } = await post("/api/waitlist/start", { ...payload, role });
      if (ok) {
        setPending({ role, email: String(payload.email).trim().toLowerCase(), instrument: String(payload.instrument), payload });
        setResendIn(RESEND_SECONDS);
        if (isResend) setNotice("We sent a new code.");
      } else if (isResend) {
        setErrors({ code: data.error ?? "Something went wrong. Please try again." });
      } else {
        showErrors({ ...(data.fields ?? {}), form: data.fields ? undefined : data.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      const msg = "We could not reach the server. Check your connection and try again.";
      if (isResend) setErrors({ code: msg }); else showErrors({ form: msg });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    const next: Errors = {};
    if (!String(payload.email ?? "").trim()) next.email = "Enter an email address";
    if (!payload.grade) next.grade = "Choose a grade";
    if (!payload.instrument) next.instrument = "Pick an instrument from the list";
    if (Object.keys(next).length) return showErrors(next);
    void sendCode(payload);
  }

  // Step 2: check the code and save the signup.
  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pending) return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6 digit code from the email" });
    setBusy(true);
    setErrors({});
    setNotice("");
    try {
      const { ok, data } = await post("/api/waitlist/verify", { role: pending.role, email: pending.email, instrument: pending.instrument, code });
      if (ok) setDone({ role: pending.role, instrument: pending.instrument, count: typeof data.count === "number" ? data.count : null });
      else setErrors({ code: data.fields?.code ?? data.error ?? "Something went wrong. Please try again." });
    } catch {
      setErrors({ code: "We could not reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setPending(null);
    setErrors({});
    setNotice("");
    setTimeout(() => formRef.current?.querySelector<HTMLElement>('[name="email"]')?.focus(), 0);
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-line bg-card p-6 sm:p-8" role="status">
        <h2 ref={doneRef} tabIndex={-1} className="font-serif text-3xl leading-tight outline-none">
          You’re on the list for <em>{done.instrument}</em>.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted">
          {done.role === "parent"
            ? `We’ll send one email when someone who plays ${done.instrument} joins as a tutor.`
            : `We’ll send one email to your parent or guardian when it’s time to set up tutoring for ${done.instrument}.`}{" "}
          Besides your code, that’s the only email, and we delete the address within 30 days of sending it.
        </p>
        {done.count !== null && (
          <p className="mt-3 text-base text-ink">
            {done.count} {done.count === 1 ? "family is" : "families are"} waiting for {done.instrument}, including yours.
          </p>
        )}
      </div>
    );
  }

  const err = (k: keyof Errors) => errors[k];
  const aria = (k: keyof Errors) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `${k}-err` : undefined });
  const Err = ({ k }: { k: keyof Errors }) =>
    err(k) ? <p id={`${k}-err`} className="mt-1.5 text-sm font-medium text-clay">{err(k)}</p> : null;

  return (
    <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">
      {pending && (
        <form onSubmit={onVerify} noValidate>
          <h2 className="font-serif text-2xl leading-tight">Check your email</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            We sent a 6 digit code to <span className="break-all font-medium text-ink">{pending.email}</span>. It expires in 10 minutes. If you don’t see it, check spam.
          </p>
          <div className="mt-5">
            <label htmlFor="code" className={label}>6 digit code</label>
            <input ref={codeRef} id="code" name="code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              autoComplete="one-time-code" required aria-required="true" placeholder="123456"
              className={`${input} text-center text-2xl tracking-[0.4em]`} {...aria("code")} />
            <Err k="code" />
            {notice && <p role="status" className="mt-1.5 text-sm text-muted">{notice}</p>}
          </div>
          <button type="submit" disabled={busy}
            className="mt-6 h-12 w-full rounded-xl bg-clay text-base font-semibold text-clay-ink hover:opacity-90 disabled:opacity-60">
            {busy ? "Checking…" : "Confirm and join"}
          </button>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <button type="button" disabled={busy || resendIn > 0} onClick={() => sendCode(pending.payload, true)}
              className="min-h-10 underline disabled:text-muted disabled:no-underline">
              {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
            </button>
            <button type="button" onClick={changeEmail} className="min-h-10 underline">Use a different email</button>
          </div>
        </form>
      )}

      {/* Stays mounted while the code step shows, so nothing they typed is lost. */}
      <form ref={formRef} onSubmit={onSubmit} noValidate hidden={!!pending}>
        <h2 className="font-serif text-2xl leading-tight">Join the list</h2>

        <fieldset className="mt-5">
          <legend className={label}>I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["parent", "Parent or guardian"], ["tutor", "High school musician"]] as const).map(([v, text]) => (
              <label key={v} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clay ${role === v ? "border-clay bg-soft text-ink" : "border-line text-muted"}`}>
                <input type="radio" name="role" value={v} checked={role === v} onChange={() => { setRole(v); setErrors({}); }} className="sr-only" />
                {text}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label htmlFor="email" className={label}>Parent or guardian email</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
            required aria-required="true" className={input} placeholder="name@example.com" {...aria("email")} />
          <p className="mt-1.5 text-sm text-muted">Students: ask a parent to fill this in. We’ll email a code to this address.</p>
          <Err k="email" />
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="grade" className={label}>{role === "parent" ? "Your student’s grade" : "Your grade"}</label>
            <select key={role} id="grade" name="grade" defaultValue="" required aria-required="true" className={input} {...aria("grade")}>
              <option value="" disabled>Choose a grade</option>
              {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <Err k="grade" />
          </div>
          <div>
            <label htmlFor="instrument" className={label}>Instrument</label>
            <select id="instrument" name="instrument" defaultValue="" required aria-required="true" className={input} {...aria("instrument")}>
              <option value="" disabled>Choose an instrument</option>
              {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <Err k="instrument" />
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="county" className={label}>North Carolina county <span className="font-normal text-muted">(optional)</span></label>
          <select id="county" name="county" defaultValue="" autoComplete="off" className={input} {...aria("county")}>
            <option value="">Skip this</option>
            {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Err k="county" />
        </div>

        {/* Honeypot. Hidden from people and screen readers. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>Company <input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
        </div>

        {errors.form && <p role="alert" className="mt-5 rounded-xl border border-clay p-3 text-sm font-medium text-clay">{errors.form}</p>}

        <button type="submit" disabled={busy}
          className="mt-6 h-12 w-full rounded-xl bg-clay text-base font-semibold text-clay-ink hover:opacity-90 disabled:opacity-60">
          {busy ? "Sending code…" : "Email me a code"}
        </button>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We email a code to check your address, then one email when it changes. We delete your address within 30 days of sending it. Nothing is sold or used for ads.{" "}
          <a className="underline" href="https://teachforacause.vercel.app/legal/privacy#waitlist">Privacy</a>
        </p>
      </form>
    </div>
  );
}
