"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Field, FormError, SelectField, SubmitButton } from "@/components/form";
import { saveEmailSettings, sendTestEmail } from "./actions";

// Settings > Email: where studio notices go, whether AI replies send
// themselves, the automatic reminders (like PhotoEZ for WordPress), and a
// test email.
export function EmailCard({
  accountEmail,
  notifyEmail,
  autoSendReplies,
  sessionReminderHours,
  balanceReminderDays,
  galleryExpiryReminderDays,
  paymentsReady,
}: {
  accountEmail: string;
  notifyEmail: string | null;
  autoSendReplies: boolean;
  sessionReminderHours: number | null;
  balanceReminderDays: number | null;
  galleryExpiryReminderDays: number | null;
  paymentsReady: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveEmailSettings, {});
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section id="email" className="card scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Email</h2>
        <Link href="/dashboard/emails" className="link text-sm">
          View email log
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Clients get emails from your studio name. When they reply, it comes straight to you.
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        <Field
          label="Your email for notices and client replies"
          name="notifyEmail"
          type="email"
          defaultValue={notifyEmail ?? ""}
          placeholder={accountEmail}
          hint="New bookings, cancellations, picks, and inquiries go here. Leave blank to use your login email."
        />

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="autoSendReplies"
            defaultChecked={autoSendReplies}
            className="mt-1 size-4 accent-lime-ink"
          />
          <span>
            <span className="block text-sm font-semibold">Send AI replies to inquiries automatically</span>
            <span className="block text-xs text-muted">
              Only for inquiries the AI fully handled from your booking page and FAQ. Anything marked &quot;Needs
              you&quot; waits for you.
            </span>
          </span>
        </label>

        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-bold tracking-wider text-muted uppercase">Automatic reminders</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <SelectField label="Session reminder" name="sessionReminderHours" defaultValue={String(sessionReminderHours ?? "off")}>
              <option value="off">Off</option>
              <option value="12">12 hours before</option>
              <option value="24">1 day before</option>
              <option value="48">2 days before</option>
              <option value="72">3 days before</option>
            </SelectField>
            <SelectField
              label="Balance due reminder"
              name="balanceReminderDays"
              defaultValue={String(balanceReminderDays ?? "off")}
              hint={paymentsReady ? undefined : "Sends once you connect Stripe."}
            >
              <option value="off">Off</option>
              <option value="1">1 day before the session</option>
              <option value="2">2 days before</option>
              <option value="3">3 days before</option>
              <option value="7">1 week before</option>
            </SelectField>
            <SelectField
              label="Gallery closing reminder"
              name="galleryExpiryReminderDays"
              defaultValue={String(galleryExpiryReminderDays ?? "off")}
              hint="For galleries with a closing date."
            >
              <option value="off">Off</option>
              <option value="1">1 day before it closes</option>
              <option value="3">3 days before</option>
              <option value="7">1 week before</option>
            </SelectField>
          </div>
        </div>

        <FormError message={state.message} />
        <div className="flex items-center gap-4">
          <SubmitButton pending={pending} fullWidth={false}>
            Save email settings
          </SubmitButton>
          {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          type="button"
          disabled={testing}
          onClick={() =>
            startTest(async () => {
              const result = await sendTestEmail();
              setTestResult("ok" in result ? { ok: true, text: result.ok } : { ok: false, text: result.error });
            })
          }
          className="btn-secondary"
        >
          {testing ? "Sending…" : "Send me a test email"}
        </button>
        {testResult && (
          <span role="status" className={`text-sm font-semibold ${testResult.ok ? "text-lime-ink" : "text-danger"}`}>
            {testResult.text}
          </span>
        )}
      </div>
    </section>
  );
}
