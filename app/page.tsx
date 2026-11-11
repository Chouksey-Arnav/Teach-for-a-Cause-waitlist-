import WaitlistForm from "@/components/WaitlistForm";
import ThemeToggle from "@/components/ThemeToggle";
import { INSTRUMENTS } from "@/lib/instruments";

const LIVE = "https://teachforacause.vercel.app";

const steps = [
  ["A parent says yes", "A parent or guardian signs off before anything unlocks. Students can’t sign up on their own."],
  ["We match by instrument and level", "Instrument first, then level, schedule, goals and learning style. A beginner gets a tutor who likes teaching beginners."],
  ["One on one on Google Meet", "A high school musician teaches your student online, for free. A parent is home or nearby the whole time."],
];

const safety = [
  ["Online only, never recorded", "Every lesson is on Google Meet. Nothing is recorded."],
  ["A parent says yes first", "Nothing unlocks until a parent signs consent."],
  ["A parent is nearby", "A parent is home or nearby and reachable during every lesson."],
  ["Messages stay on the platform", "Phone numbers, emails, links and social apps are blocked, and parents can read every message."],
];

const faqs = [
  ["Does it cost anything?", "No. Lessons are free, and we never handle money."],
  ["Who teaches the lessons?", "High school band and orchestra players in grades 9 to 12. They’re volunteers, not certified teachers, and their skill levels are self reported. We match by instrument first, then level, schedule, goals and learning style."],
  ["Is it safe?", "Lessons are online only on Google Meet and never recorded. A parent says yes before anything unlocks, and a parent is home or nearby and reachable during every lesson. Messages stay on the platform, and parents can read every one. A safety report pauses a tutor right away."],
  ["Does my student need to be in a school band?", "No. They need their own instrument, and that’s it."],
  ["When will we get a tutor?", "We can’t promise a date. Tutors are limited right now, so we email once when someone who plays your instrument joins."],
];

const footerLinks = [
  ["Terms of Service", "/legal/terms"], ["Privacy Policy", "/legal/privacy"], ["Parent consent", "/legal/consent"],
  ["Messaging guidelines", "/legal/messaging"], ["Tutor agreement", "/legal/tutor-agreement"], ["Code of conduct", "/legal/code-of-conduct"],
];

const h2 = "font-serif text-3xl leading-tight sm:text-4xl";
const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";

export default function Page() {
  return (
    <>
      <a href="#join" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Skip to the form</a>

      <header className={`${wrap} flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4`}>
        <div className="flex items-center gap-3">
          <a href={LIVE} className="font-serif text-xl">Teach for a Cause</a>
          <span className="text-xs text-muted border border-line rounded-full px-2.5 py-0.5">Waitlist</span>
        </div>
        <nav aria-label="Main" className="order-3 flex w-full gap-5 overflow-x-auto text-sm text-muted md:order-none md:w-auto">
          <a className="whitespace-nowrap py-2 hover:text-ink" href="#how">How it works</a>
          <a className="whitespace-nowrap py-2 hover:text-ink" href="#safety">Safety</a>
          <a className="whitespace-nowrap py-2 hover:text-ink" href="#tutors">For tutors</a>
          <a className="whitespace-nowrap py-2 hover:text-ink" href="#faq">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main>
        <section className={`${wrap} grid items-start gap-10 py-10 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16`}>
          <div className="lg:pt-6">
            <h1 className="font-serif text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
              Tell us what you play, and we’ll email you when a <em>tutor</em> joins.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Teach for a Cause is a student led volunteer program in North Carolina. High school band and orchestra players teach middle schoolers one on one over Google Meet, for free. We’re in beta and tutors are limited, so we keep a short list and send one email when someone who plays your instrument joins.
            </p>
          </div>
          <div id="join"><WaitlistForm /></div>
        </section>

        <section aria-label="Supported instruments" className={`${wrap} pb-14`}>
          <ul className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((i) => (
              <li key={i} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-muted">{i}</li>
            ))}
          </ul>
        </section>

        <section id="how" className={`${wrap} py-14`}>
          <h2 className={h2}>How it <em>works</em></h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map(([t, d], n) => (
              <li key={t} className="rounded-3xl border border-line bg-card p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm text-muted">{n + 1}</span>
                <h3 className="mt-4 font-serif text-xl leading-snug">{t}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="safety" className="bg-soft py-14">
          <div className={wrap}>
            <h2 className={h2}>Safety is built <em>in</em></h2>
            <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {safety.map(([t, d]) => (
                <li key={t} className="border-t border-line pt-4">
                  <h3 className="text-base font-semibold">{t}</h3>
                  <p className="mt-1.5 text-base leading-relaxed text-muted">{d}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-base text-muted">
              A safety report pauses a tutor right away. <a className="underline" href={`${LIVE}/safety`}>Read the full safety page</a>
            </p>
          </div>
        </section>

        <section id="tutors" className={`${wrap} py-14`}>
          <div className="rounded-3xl border border-line bg-card p-6 sm:p-10">
            <h2 className={h2}>For high school <em>musicians</em></h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
              Tutors are the reason this works, and we need more of them. If you play band or orchestra in grades 9 to 12, you can teach one student at a time over Google Meet. You log each lesson, the family confirms it, and a nonprofit partner reviews the hours. Whether the hours count for NHS, Tri-M or a school requirement is up to that organization. Tutors are volunteers, not certified teachers.
            </p>
            <a href="/?role=tutor#join" className="mt-6 inline-flex h-12 items-center rounded-xl bg-clay px-6 text-base font-semibold text-clay-ink hover:opacity-90">
              Join as a tutor
            </a>
            <p className="mt-3 text-sm text-muted">You’ll need your email to verify with a code.</p>
          </div>
        </section>

        <section id="faq" className={`${wrap} py-14`}>
          <h2 className={h2}>Common <em>questions</em></h2>
          <div className="mt-8 max-w-3xl divide-y divide-line border-y border-line">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex items-center justify-between gap-4 text-lg font-medium">
                  {q}
                  <span aria-hidden="true" className="chev text-2xl leading-none text-muted">+</span>
                </summary>
                <p className="mt-3 text-base leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className={wrap}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {footerLinks.map(([t, h]) => <li key={t}><a className="text-muted underline hover:text-ink" href={`${LIVE}${h}`}>{t}</a></li>)}
            <li><a className="text-muted underline hover:text-ink" href="mailto:chouksey.arnav@gmail.com">chouksey.arnav@gmail.com</a></li>
          </ul>
          <p className="mt-6 text-sm text-muted">© 2026 Teach for a Cause. Lessons are always free. We never handle money.</p>
          <p className="mt-2 text-sm text-muted">
            Not affiliated with or endorsed by any school or school{" "}
            <a
              href="/admin"
              className="text-inherit no-underline cursor-default select-none focus:outline-none"
              tabIndex={-1}
              aria-label="district"
            >
              district
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  );
}
