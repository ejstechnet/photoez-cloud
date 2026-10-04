"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { SOURCE_COOKIE } from "@/lib/leads";
import { PLAN_LABELS, TRIAL_DAYS } from "@/lib/plans";
import { HEADACHES, QUIZ_COOKIE, SHOOTS, TOOLS, VOLUMES, encodeAnswers, quizResult, type QuizAnswers } from "@/lib/quiz";

const STEPS = ["What you shoot", "Your tools", "Headache", "Sessions"];

const money = (cents: number) => `$${Math.round(cents / 100)}`;

function setCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=86400; Path=/; SameSite=Lax${secure}`;
}

// Four questions, one per screen, then the personal result.
export function QuizFlow({ source }: { source: string | null }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({ shoots: [], tools: [], headache: "", volume: "" });

  const toggle = (key: "shoots" | "tools", id: string) =>
    setAnswers((a) => {
      const has = a[key].includes(id);
      return { ...a, [key]: has ? a[key].filter((x) => x !== id) : [...a[key], id] };
    });
  const pickOne = (key: "headache" | "volume", id: string) => {
    const next = { ...answers, [key]: id };
    setAnswers(next);
    // Single-choice questions move on by themselves.
    window.setTimeout(() => finishStep(next), 180);
  };
  function finishStep(a: QuizAnswers) {
    if (step === STEPS.length - 1) {
      // The answers and the ad tag go along to sign-up (saved with the account).
      setCookie(QUIZ_COOKIE, encodeAnswers(a));
      if (source) setCookie(SOURCE_COOKIE, source);
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canNext = step === 0 ? answers.shoots.length > 0 : step === 1 ? answers.tools.length > 0 : true;
  const signup = `/signup${source ? `?src=${encodeURIComponent(source)}` : ""}`;

  if (step >= STEPS.length) return <Result answers={answers} signup={signup} />;

  const option = (selected: boolean) =>
    `flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-semibold transition ${
      selected ? "border-lime bg-lime/15 text-white" : "border-white/15 bg-white/5 text-white/90 hover:border-white/40"
    }`;
  const tick = (selected: boolean) => (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full text-sm font-bold ${
        selected ? "bg-lime text-brand-deep" : "bg-white/10 text-transparent"
      }`}
      aria-hidden="true"
    >
      ✓
    </span>
  );

  return (
    <div className="relative text-white">
      <ol className="flex flex-wrap gap-2" aria-label="Quiz steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tracking-wider uppercase ${
              i === step ? "bg-lime text-brand-deep" : i < step ? "bg-white/20 text-white" : "bg-white/5 text-white/50 ring-1 ring-white/15"
            }`}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="grid size-5 place-items-center rounded-full bg-brand-deep/20 text-[11px]">{i < step ? "✓" : i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="mt-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">What do you shoot?</h1>
          <p className="mt-2 text-white/70">Pick all that apply.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {SHOOTS.map((s) => {
              const on = answers.shoots.includes(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle("shoots", s.id)} className={option(on)}>
                  {tick(on)} {s.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="mt-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">What do you use now?</h1>
          <p className="mt-2 text-white/70">Pick everything you pay for or juggle.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TOOLS.map((t) => {
              const on = answers.tools.includes(t.id);
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle("tools", t.id)} className={option(on)}>
                  {tick(on)} {t.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">What&rsquo;s your biggest headache?</h1>
          <div className="mt-6 grid gap-3">
            {HEADACHES.map((h) => {
              const on = answers.headache === h.id;
              return (
                <button key={h.id} type="button" aria-pressed={on} onClick={() => pickOne("headache", h.id)} className={option(on)}>
                  {tick(on)} {h.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">How many sessions a month?</h1>
          <p className="mt-2 text-white/70">In a typical busy month.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {VOLUMES.map((v) => {
              const on = answers.volume === v.id;
              return (
                <button key={v.id} type="button" aria-pressed={on} onClick={() => pickOne("volume", v.id)} className={option(on)}>
                  {tick(on)} {v.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="text-sm font-bold tracking-wider text-white/70 uppercase hover:text-white">
            ← Back
          </button>
        ) : (
          <span />
        )}
        {step < 2 && (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => finishStep(answers)}
            className="btn-primary bg-lime text-brand-deep disabled:opacity-40"
          >
            Next <ArrowRightIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function Result({ answers, signup }: { answers: QuizAnswers; signup: string }) {
  const r = quizResult(answers);
  return (
    <div className="relative text-white">
      <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">Your result</p>
      <h1 className="mt-4 font-display text-3xl leading-tight font-bold tracking-tight sm:text-5xl">
        {r.replaced.length > 0 ? (
          <>
            PhotoEZ Cloud replaces <span className="italic text-lime">{r.replaced.length === 1 ? "1 tool" : `${r.replaced.length} tools`}</span>
            {r.savingsCents > 0 && (
              <>
                {" "}
                and saves you about <span className="italic text-sun">{money(r.savingsCents)} a year</span>
              </>
            )}
            .
          </>
        ) : (
          <>
            Everything you juggle, <span className="italic text-lime">in one place.</span>
          </>
        )}
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-white/10 p-6 ring-1 ring-white/10">
          <p className="text-sm font-bold tracking-wider text-lime uppercase">Your biggest headache, handled</p>
          <p className="mt-3 text-lg leading-relaxed text-white/90">{r.answer}</p>
        </div>
        <div className="rounded-3xl bg-white/10 p-6 ring-1 ring-white/10">
          <p className="text-sm font-bold tracking-wider text-lime uppercase">The plan that fits</p>
          <p className="mt-3 font-display text-4xl font-bold">
            {PLAN_LABELS[r.plan]} <span className="text-xl text-white/70">{money(r.planCents)}/month</span>
          </p>
          <p className="mt-2 text-white/75">Free for {TRIAL_DAYS} days, no card needed. Keep a Free plan after if you like.</p>
        </div>
      </div>

      {r.missing.length > 0 && (
        <div className="mt-4 rounded-3xl bg-white/10 p-6 ring-1 ring-white/10">
          <p className="text-sm font-bold tracking-wider text-sun uppercase">What you&apos;re missing out on</p>
          <p className="mt-1 text-sm text-white/60">Your current setup doesn&apos;t do these. PhotoEZ Cloud Pro and Studio both do.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {r.missing.map((f) => (
              <li key={f.id} className="flex gap-3">
                <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-sm font-bold text-brand-deep">
                  ✓
                </span>
                <span>
                  <span className="block font-semibold text-white">{f.label}</span>
                  <span className="block text-sm text-white/70">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.replaced.length > 0 && (
        <div className="mt-4 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <p className="text-sm font-bold tracking-wider text-white/70 uppercase">What you can retire</p>
          <ul className="mt-3 space-y-2">
            {r.replaced.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4">
                <span className="font-semibold text-white/90 line-through decoration-coral decoration-2">{t.label}</span>
                <span className="text-white/60">about {money(t.cents)}/mo</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-4 border-t border-white/10 pt-2 font-bold">
              <span>Instead: PhotoEZ Cloud {PLAN_LABELS[r.plan]}</span>
              <span className="text-lime">{money(r.planCents)}/mo</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-white/50">Typical entry-plan prices, billed yearly where offered. Yearly savings compare a year of these with PhotoEZ Cloud billed yearly. Your own costs may differ.</p>
        </div>
      )}

      <div className="mt-8 text-center sm:text-left">
        <Link href={signup} className="btn-primary w-full justify-center bg-lime text-lg text-brand-deep sm:w-auto">
          Start your free trial <ArrowRightIcon size={20} />
        </Link>
        <p className="mt-3 text-sm font-semibold text-white/70">✓ No card needed · ✓ 0% commission · ✓ Set up in minutes</p>
      </div>
    </div>
  );
}
