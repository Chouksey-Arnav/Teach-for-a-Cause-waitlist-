"use client";
import { useEffect, useRef, useState } from "react";
import { INSTRUMENTS } from "@/lib/instruments";
import { COUNTIES } from "@/lib/counties";

type Role = "parent" | "tutor";
type Errors = Partial<Record<"role" | "email" | "grade" | "instrument" | "county" | "form", string>>;
type Done = { role: Role; instrument: string; count: number | null };

const input = "h-12 w-full rounded-xl border border-line bg-bg px-3 text-base text-ink placeholder:text-muted";
const label = "mb-1.5 block text-sm font-medium text-ink";

export default function WaitlistForm() {
  const [role, setRole] = useState<Role>("parent");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("role") === "tutor") setRole("tutor");
  }, []);
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  const grades = role === "parent" ? [6, 7, 8] : [9, 10, 11, 12];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = Object.fromEntries(f.entries());
    const next: Errors = {};
    if (!String(payload.email ?? "").trim()) next.email = "Enter an email address";
    if (!payload.grade) next.grade = "Choose a grade";
    if (!payload.instrument) next.instrument = "Pick an instrument from the list";
    if (Object.keys(next).length) return showErrors(next);

    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setDone({ role, instrument: String(payload.instrument), count: typeof data.count === "number" ? data.count : null });
      } else {
        showErrors({ ...(data.fields ?? {}), form: data.fields ? undefined : data.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      showErrors({ form: "We could not reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  function showErrors(next: Errors) {
    setErrors(next);
    const first = (["email", "grade", "instrument", "county"] as const).find((k) => next[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
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
          That’s the only email, and we delete the address within 30 days of sending it.
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
    <form ref={formRef} onSubmit={onSubmit} noValidate className="rounded-3xl border border-line bg-card p-6 sm:p-8">
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
        <p className="mt-1.5 text-sm text-muted">Students: ask a parent to fill this in.</p>
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
        {busy ? "Saving…" : role === "parent" ? "Join the list" : "Join as a tutor"}
      </button>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        One email when it changes, nothing else. We delete your address within 30 days of sending it. Nothing is sold or used for ads.{" "}
        <a className="underline" href="https://teachforacause.vercel.app/legal/privacy#waitlist">Privacy</a>
      </p>
    </form>
  );
}
