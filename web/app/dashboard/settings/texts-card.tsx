"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { CopyLink } from "@/components/copy-link";
import { Field, FormError, SubmitButton } from "@/components/form";
import { SMS_LABELS, type SmsKind, type SmsSettings } from "@/lib/sms/messages";
import { disconnectTwilio, saveTextSettings, sendTestTextAction } from "./texts-actions";

// Settings > Text messages: texts go through the studio's OWN Twilio account
// (it pays Twilio directly). Only clients who ticked "Text me reminders" on
// the booking form, or that the studio marked as agreeing, get texts.
export function TextsCard({
  allowed,
  upgradeLabel,
  sid,
  hasToken,
  from,
  alertPhone,
  texts,
  replyUrl,
  legalName,
  legalState,
  slug,
}: {
  allowed: boolean;
  upgradeLabel: string;
  sid: string | null;
  hasToken: boolean;
  from: string | null;
  alertPhone: string | null;
  texts: SmsSettings;
  // Where Twilio should send replies (for STOP / START).
  replyUrl: string;
  legalName: string | null;
  legalState: string | null;
  // For the links to the studio's Terms, Privacy, and text sign-up pages.
  slug: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveTextSettings, {});
  const [testPhone, setTestPhone] = useState(alertPhone ?? "");
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, startTest] = useTransition();
  const connected = Boolean(sid && hasToken && from);

  return (
    <section id="texts" className="card scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Text messages</h2>
        {allowed && (
          <Link href="/dashboard/texts" className="link text-sm">
            View text log
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Text reminders to clients through your own Twilio account. Twilio bills you directly for your texts. Clients only get texts if
        they ticked &ldquo;Text me reminders&rdquo; when booking (or you mark them as agreeing on their client page), and replying STOP
        ends them.
      </p>

      {!allowed ? (
        <p className="mt-5 rounded-2xl bg-sun/30 px-5 py-4 text-sm font-medium">
          Text messages are on the {upgradeLabel} plan and up.{" "}
          <Link href="/dashboard/billing" className="link">
            See plans
          </Link>
        </p>
      ) : (
        <>
          <form action={formAction} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Twilio Account SID" name="sid" defaultValue={sid ?? ""} placeholder="AC…" autoComplete="off" spellCheck={false} />
              <Field
                label="Twilio Auth Token"
                name="token"
                type="password"
                autoComplete="new-password"
                placeholder={hasToken ? "Saved. Leave blank to keep it" : "From your Twilio Console"}
                hint="Stored encrypted. It's never shown again."
              />
              <Field
                label="Your Twilio number"
                name="from"
                defaultValue={from ?? ""}
                placeholder="(503) 555-1234"
                hint="The number texts come from. A Messaging Service SID (MG…) works too."
              />
              <Field
                label="Your cell, for alerts"
                name="alertPhone"
                type="tel"
                defaultValue={alertPhone ?? ""}
                placeholder="(503) 555-6789"
                hint="Where new booking and inquiry texts go. Optional."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field
                label="Registered business name"
                name="legalName"
                defaultValue={legalName ?? ""}
                placeholder="e.g. Bright Studio LLC"
                hint="Exactly as registered with Twilio (your texting brand). Shown on your studio's Terms and Privacy pages."
              />
              <Field label="Business state" name="legalState" defaultValue={legalState ?? ""} placeholder="OR" maxLength={2} hint="For your Terms." />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Which texts go out</legend>
              {(Object.keys(SMS_LABELS) as SmsKind[]).map((k) => (
                <label key={k} className="flex items-start gap-3">
                  <input type="checkbox" name={k} defaultChecked={texts[k]} className="mt-1 size-4 accent-lime-ink" />
                  <span className="text-sm">
                    <span className="font-semibold">{SMS_LABELS[k].label}</span>
                    <span className="block text-muted">{SMS_LABELS[k].note}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <FormError message={state.message} />
            {state.saved && <p className="rounded-xl bg-lime/20 px-3.5 py-2.5 text-sm font-semibold">{state.saved}</p>}
            <SubmitButton pending={pending} fullWidth={false}>
              Save text settings
            </SubmitButton>
          </form>

          {connected && (
            <div className="mt-8 space-y-6 border-t border-border pt-6">
              <div>
                <p className="text-sm font-semibold">Send a test text</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    type="tel"
                    placeholder="Your cell number"
                    className="h-11 min-w-0 flex-1 rounded-full border-2 border-border bg-background px-4 text-sm"
                  />
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() =>
                      startTest(async () => {
                        const r = await sendTestTextAction(testPhone);
                        setTestResult(r.ok ? { ok: true, text: "Sent! It should arrive in a few seconds." } : { ok: false, text: r.message ?? "It didn't send." });
                      })
                    }
                    className="btn-secondary h-11 py-0"
                  >
                    {testing ? "Sending…" : "Send test text"}
                  </button>
                </div>
                {testResult && <p className={`mt-2 text-sm font-medium ${testResult.ok ? "text-lime-ink" : "text-danger"}`}>{testResult.text}</p>}
              </div>

              <div>
                <p className="text-sm font-semibold">So STOP replies reach PhotoEZ Cloud</p>
                <p className="mt-1 text-sm text-muted">
                  In Twilio, open <strong>Phone Numbers → Manage → Active numbers</strong>, click your number, and under{" "}
                  <strong>Messaging Configuration</strong> set &ldquo;A message comes in&rdquo; to <strong>Webhook</strong>, this address,{" "}
                  <strong>HTTP POST</strong>. Then click <strong>Save configuration</strong>. (Using a Messaging Service? Put it in the
                  service&apos;s <strong>Integration</strong> settings instead.)
                </p>
                <div className="mt-2">
                  <CopyLink url={replyUrl} label="Address for Twilio replies" />
                </div>
              </div>

              {slug && (
                <div className="text-sm">
                  <p className="font-semibold">Links for your Twilio registration</p>
                  <ul className="mt-1 space-y-1 text-muted">
                    <li>
                      Terms and Conditions:{" "}
                      <a href={`/studio/${slug}/terms`} target="_blank" className="link break-all">
                        {`photoezcloud.com/studio/${slug}/terms`}
                      </a>
                    </li>
                    <li>
                      Privacy Policy:{" "}
                      <a href={`/studio/${slug}/privacy`} target="_blank" className="link break-all">
                        {`photoezcloud.com/studio/${slug}/privacy`}
                      </a>
                    </li>
                    <li>
                      Opt-in page:{" "}
                      <a href={`/studio/${slug}/texts`} target="_blank" className="link break-all">
                        {`photoezcloud.com/studio/${slug}/texts`}
                      </a>
                    </li>
                  </ul>
                </div>
              )}

              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">US texting rules (A2P 10DLC)</summary>
                <p className="mt-2 text-muted">
                  US carriers only deliver business texts from numbers registered for A2P 10DLC. In Twilio, go to{" "}
                  <strong>Messaging → Regulatory Compliance</strong> and register your business and a campaign (use case
                  &ldquo;Customer Care&rdquo; or &ldquo;Account Notifications&rdquo;). It takes a few days and Twilio charges a small fee.
                  Until it&apos;s approved, texts may show as sent but never arrive.
                </p>
              </details>

              <button
                type="button"
                onClick={() => window.confirm("Disconnect Twilio? No more texts will go out until you add your details again.") && disconnectTwilio()}
                className="text-sm font-semibold text-danger underline"
              >
                Disconnect Twilio
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
