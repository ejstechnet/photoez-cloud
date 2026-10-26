// The Support page's contact form (app/support): who's writing, what it's
// about, and the email it sends PhotoEZ Cloud's owner. No Next.js or
// database here, so it's tested in support.test.ts.
import { z } from "zod";
import type { EmailContent } from "./email/layout.ts";

export const SUPPORT_ROLES = ["photographer", "client"] as const;
export type SupportRole = (typeof SUPPORT_ROLES)[number];

export const ROLE_LABELS: Record<SupportRole, string> = {
  photographer: "Photographer",
  client: "Client of a photographer",
};

// What a message can be about. Clients get their own list, since they use
// galleries and booking pages, not the dashboard.
export const SUPPORT_TOPICS: Record<SupportRole, { value: string; label: string }[]> = {
  photographer: [
    { value: "question", label: "A question about how something works" },
    { value: "problem", label: "Something isn't working" },
    { value: "bug", label: "Report a bug" },
    { value: "billing", label: "My plan or billing" },
    { value: "idea", label: "An idea or feature request" },
  ],
  client: [
    { value: "gallery", label: "My gallery or downloads" },
    { value: "booking", label: "Booking, my contract, or paying" },
    { value: "bug", label: "Report a bug" },
    { value: "other", label: "Something else" },
  ],
};

export function topicLabel(role: SupportRole, topic: string): string | null {
  return SUPPORT_TOPICS[role].find((t) => t.value === topic)?.label ?? null;
}

const formSchema = z
  .object({
    role: z.enum(SUPPORT_ROLES, "Choose who you are."),
    topic: z.string().trim(),
    name: z.string().trim().min(1, "Enter your name.").max(120),
    email: z.email("Enter a valid email address.").trim().max(254),
    // A photographer's own studio, or the studio a client booked with.
    studio: z.string().trim().max(120).transform((v) => v || null),
    pageUrl: z.string().trim().max(500).transform((v) => v || null),
    message: z
      .string()
      .trim()
      .min(10, "Tell us a little more so we can help.")
      .max(5000, "Keep your message under 5,000 characters."),
  })
  .refine((d) => topicLabel(d.role, d.topic) !== null, { path: ["topic"], message: "Choose what this is about." });

export type SupportFields = keyof z.input<typeof formSchema>;
export type SupportMessage = z.output<typeof formSchema>;

// Checks what the form sent; field errors come back in plain words.
export function parseSupportForm(
  input: Record<SupportFields, string>,
): { data: SupportMessage } | { errors: Partial<Record<SupportFields, string>> } {
  const parsed = formSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data };
  const errors: Partial<Record<SupportFields, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as SupportFields;
    errors[field] ??= issue.message;
  }
  return { errors };
}

// The email to the owner. Replies go straight to the sender.
export function supportEmail(
  m: SupportMessage,
  extra: { account: string | null; userAgent: string | null; inboxUrl: string },
): EmailContent {
  const topic = topicLabel(m.role, m.topic) ?? m.topic;
  const details: [string, string][] = [
    ["From", `${m.name} (${m.email})`],
    ["Who", ROLE_LABELS[m.role]],
    ["About", topic],
  ];
  if (m.studio) details.push([m.role === "client" ? "Their photographer" : "Studio", m.studio]);
  if (extra.account) details.push(["Logged in as", extra.account]);
  if (m.pageUrl) details.push(["Page", m.pageUrl]);
  if (extra.userAgent) details.push(["Browser", extra.userAgent]);
  return {
    subject: `Support: ${topic} (${m.name})`,
    heading: "New support message",
    intro: [m.message],
    details,
    button: { label: "Open Support inbox", url: extra.inboxUrl },
    outro: [`Reply to this email to answer ${m.name}.`],
  };
}
