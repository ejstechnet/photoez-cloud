"use client";

import { ConfirmButton } from "../../bookings/confirm-button";
import { setClientTexts } from "./text-consent-actions";

// Client page: whether this client gets text reminders, and why.
export function TextConsent({
  clientId,
  phone,
  status,
}: {
  clientId: string;
  phone: string | null;
  // in/out and where it came from; null = never asked.
  status: { status: "in" | "out"; source: "booking" | "form" | "studio" | "reply" } | null;
}) {
  const line = !phone
    ? "Add a phone number to text this client."
    : status?.status === "in"
      ? status.source === "booking"
        ? "Gets text reminders. They asked for them when booking."
        : status.source === "form"
          ? "Gets text reminders. They signed up on your text reminders page."
          : status.source === "reply"
          ? "Gets text reminders. They replied START."
          : "Gets text reminders. You marked them as agreeing."
      : status?.source === "reply"
        ? "No texts: they replied STOP. Only they can turn texts back on, by replying START."
        : "No texts. Clients get texts when they tick “Text me reminders” while booking.";

  return (
    <section className="card mt-8 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold">Text messages</h2>
      <p className="mt-1 text-sm text-muted">{line}</p>
      {phone && status?.status === "in" && (
        <div className="mt-4">
          <ConfirmButton action={setClientTexts.bind(null, clientId, false)} confirmText="Stop texting this client?" pendingLabel="Saving…" danger>
            Stop texting
          </ConfirmButton>
        </div>
      )}
      {phone && status?.status !== "in" && status?.source !== "reply" && (
        <div className="mt-4">
          <ConfirmButton
            action={setClientTexts.bind(null, clientId, true)}
            confirmText="Only do this if the client told you they'd like text reminders. Continue?"
            pendingLabel="Saving…"
          >
            They agreed to texts
          </ConfirmButton>
        </div>
      )}
    </section>
  );
}
