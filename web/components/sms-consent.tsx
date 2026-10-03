// The text-reminder opt-in checkbox and its wording, shared by the booking
// form and the studio's text sign-up page so carriers (A2P 10DLC review) see
// the same consent everywhere. Never ticked by default.
export function SmsConsent({ slug, studioName, required = false }: { slug: string; studioName?: string; required?: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name="smsOptIn" required={required} className="mt-0.5 size-4 shrink-0 accent-lime-ink" />
      <span>
        Text me reminders{studioName ? ` from ${studioName}` : ""} about my session and photos (session reminders, payment
        reminders, and gallery notices).{" "}
        <span className="text-muted">
          Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.
          {required ? "" : " Not required to book."}{" "}
          <a href={`/studio/${slug}/terms`} target="_blank" className="underline">
            Terms
          </a>{" "}
          &amp;{" "}
          <a href={`/studio/${slug}/privacy`} target="_blank" className="underline">
            Privacy Policy
          </a>
        </span>
      </span>
    </label>
  );
}
