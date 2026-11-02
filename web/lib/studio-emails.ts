// The owner's emails to PhotoEZ Cloud's photographers (Settings > Email
// studios): who's in each group, the {first_name}-style fill-ins, checking a
// draft, and the email it becomes. No database or Node-only code, so the
// composer can preview in the browser; tested in studio-emails.test.ts.
import { toParagraphs, type EmailContent } from "./email/layout.ts";
import { onTrial, type Plan } from "./plans.ts";

export type StudioRow = {
  id: string;
  name: string;
  businessName: string | null;
  email: string;
  plan: Plan;
  trialEndsAt: Date | null;
  emailVerified: boolean;
  createdAt: Date;
  optedOut: boolean;
};

export const AUDIENCES = ["all", "trial", "free", "paying", "new", "unconfirmed"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "All studios",
  trial: "On the Pro trial",
  free: "Free (trial over)",
  paying: "Paying (Pro or Studio)",
  new: "Joined in the last 7 days",
  unconfirmed: "Haven't confirmed their email",
};

export function inAudience(s: StudioRow, audience: Audience, now = new Date()): boolean {
  switch (audience) {
    case "all":
      return true;
    case "trial":
      return onTrial(s.plan, s.trialEndsAt, now);
    case "free":
      return s.plan === "free" && !onTrial(s.plan, s.trialEndsAt, now);
    case "paying":
      return s.plan !== "free";
    case "new":
      return s.createdAt.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000;
    case "unconfirmed":
      return !s.emailVerified;
  }
}

// What {first_name} and friends become for one studio.
export const FILL_INS = ["first_name", "name", "studio_name", "email"] as const;

export function fillIn(text: string, s: Pick<StudioRow, "name" | "businessName" | "email">): string {
  const values: Record<(typeof FILL_INS)[number], string> = {
    first_name: s.name.trim().split(/\s+/)[0] || "there",
    name: s.name.trim() || "there",
    studio_name: s.businessName?.trim() || s.name.trim(),
    email: s.email,
  };
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key as keyof typeof values] : match));
}

// On a line of its own in the message, {button} marks where the button goes
// (otherwise it comes after the message), so a sign-off can follow it.
export const BUTTON_MARK = "{button}";

// Fill-ins in the text that aren't one of FILL_INS, e.g. a typo like {firstname}.
export function unknownFillIns(text: string): string[] {
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((k) => k !== "button" && !(FILL_INS as readonly string[]).includes(k)))];
}

export type Draft = { subject: string; heading: string; body: string; buttonLabel: string; buttonUrl: string };
export type DraftErrors = Partial<Record<keyof Draft, string>>;

// Problems with a draft, in plain words; empty when it's ready to send.
export function checkDraft(d: Draft): DraftErrors {
  const errors: DraftErrors = {};
  if (!d.subject.trim()) errors.subject = "Add a subject.";
  else if (d.subject.length > 200) errors.subject = "Keep the subject under 200 characters.";
  if (d.heading.length > 200) errors.heading = "Keep the heading under 200 characters.";
  if (!d.body.trim()) errors.body = "Write the message.";
  else if (d.body.length > 10000) errors.body = "Keep the message under 10,000 characters.";
  const label = d.buttonLabel.trim();
  const url = d.buttonUrl.trim();
  if (label && !url) errors.buttonUrl = "Add the address the button opens, or clear the button text.";
  if (url && !label) errors.buttonLabel = "Add the button text, or clear the address.";
  if (url && !/^https?:\/\/\S+$/.test(url)) errors.buttonUrl = "Use a full address starting with https://";
  return errors;
}

// One studio's email: the draft with their fill-ins, and the button where
// {button} is (or after the message).
export function studioEmailContent(d: Draft, s: Pick<StudioRow, "name" | "businessName" | "email">): EmailContent {
  const label = d.buttonLabel.trim();
  const paragraphs = toParagraphs(fillIn(d.body, s));
  const mark = paragraphs.indexOf(BUTTON_MARK);
  return {
    subject: fillIn(d.subject.trim(), s),
    heading: d.heading.trim() ? fillIn(d.heading.trim(), s) : undefined,
    intro: mark === -1 ? paragraphs : paragraphs.slice(0, mark),
    button: label && d.buttonUrl.trim() ? { label: fillIn(label, s), url: d.buttonUrl.trim() } : undefined,
    outro: mark === -1 ? undefined : paragraphs.slice(mark + 1),
  };
}

// The line under every one of these emails, with the studio's own unsubscribe link.
export function studioEmailFooter(unsubscribeUrl: string) {
  return `You're getting this because you have a PhotoEZ Cloud studio. Don't want these updates? Unsubscribe: ${unsubscribeUrl}`;
}

// The templates a new install starts with; the owner can edit or delete them.
export function starterTemplates(siteUrl: string): (Draft & { name: string })[] {
  return [
    {
      name: "Welcome",
      subject: "Welcome to PhotoEZ Cloud, {first_name}!",
      heading: "Welcome aboard!",
      body: [
        "Hi {first_name},",
        "I'm Elle, the photographer who built PhotoEZ Cloud. Thank you for giving it a try with {studio_name}!",
        "Three things get you ready for clients fastest:\n1. Set up your studio page and connect Stripe.\n2. Add a session and your hours, so clients can book you.\n3. Upload a gallery and send it to a client.",
        "If anything is confusing or you get stuck, just reply to this email. It comes straight to me.",
        BUTTON_MARK,
        "Elle",
      ].join("\n\n"),
      buttonLabel: "Open my dashboard",
      buttonUrl: `${siteUrl}/dashboard`,
    },
    {
      name: "Trial check-in",
      subject: "How's PhotoEZ Cloud going, {first_name}?",
      heading: "",
      body: [
        "Hi {first_name},",
        "You've had a few days with PhotoEZ Cloud now, and I wanted to check in. How's it going so far?",
        "Is there anything you were hoping it would do that it doesn't, or anything that's been harder than it should be? I read every reply, and a lot of what's in PhotoEZ Cloud today came from photographers telling me what they needed.",
        "Elle",
      ].join("\n\n"),
      buttonLabel: "",
      buttonUrl: "",
    },
    {
      name: "Trial ending soon",
      subject: "Your Pro trial ends soon",
      heading: "Keep everything Pro gives you",
      body: [
        "Hi {first_name},",
        "Your free Pro trial for {studio_name} is ending soon. When it does, your studio moves to the Free plan. Nothing is deleted, but extra photo sales, quotes and invoices, slideshows, and text reminders turn off, and Free holds 3 active galleries.",
        "If PhotoEZ Cloud has been helpful, you can keep Pro from Billing in your dashboard. And if something's holding you back, reply and tell me. I'd love to help.",
        BUTTON_MARK,
        "Elle",
      ].join("\n\n"),
      buttonLabel: "See plans",
      buttonUrl: `${siteUrl}/dashboard/billing`,
    },
    {
      name: "New feature announcement",
      subject: "New in PhotoEZ Cloud: [feature name]",
      heading: "Something new for {studio_name}",
      body: [
        "Hi {first_name},",
        "[Describe the new feature in a sentence or two: what it does and why it helps.]",
        "[Say where to find it, e.g. \"Open any gallery and look for…\"]",
        "As always, reply if you have questions or ideas.",
        BUTTON_MARK,
        "Elle",
      ].join("\n\n"),
      buttonLabel: "Try it now",
      buttonUrl: `${siteUrl}/dashboard`,
    },
    {
      name: "Tips & how-tos",
      subject: "3 quick ways to save time in PhotoEZ Cloud",
      heading: "Three quick tips",
      body: [
        "Hi {first_name},",
        "A few features photographers love once they find them:",
        "1. Culling help: open a gallery's proofs and click Check photos. It flags blurry, dark, and duplicate shots before your client sees them.\n2. AI replies: fill in your Client FAQ in Settings, and new inquiries get a drafted reply in your voice.\n3. The Studio Assistant: ask \"Who still owes a balance?\" and it can draft the reminder emails for you to approve.",
        "There are step-by-step guides for everything on the Help page.",
        BUTTON_MARK,
        "Elle",
      ].join("\n\n"),
      buttonLabel: "Open the guides",
      buttonUrl: `${siteUrl}/support`,
    },
    {
      name: "Blank",
      subject: "",
      heading: "",
      body: "Hi {first_name},\n\n\n\nElle",
      buttonLabel: "",
      buttonUrl: "",
    },
  ];
}
