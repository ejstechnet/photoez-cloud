import type Anthropic from "@anthropic-ai/sdk";

// Every Studio Assistant tool, with what it's allowed to do:
//   read      only reads the studio's data; runs right away.
//   write     changes data in PhotoEZ Cloud.
//   external  reaches outside the app: emails, texts, payments.
// write and external tools never run when the model calls them: they become
// an approval card, and only executeTool (executor.ts) runs them, with the
// photographer's approval. `effect` is required, so a new tool without one
// doesn't typecheck.

export type ToolEffect = "read" | "write" | "external";
export type AssistantToolSpec = Anthropic.Tool & { effect: ToolEffect };

const DATE = { type: "string", description: "A calendar day, YYYY-MM-DD, in the studio's time zone." } as const;

export const TOOL_REGISTRY: AssistantToolSpec[] = [
  {
    name: "studio_overview",
    effect: "read",
    description: "Today's date and a snapshot of the studio: upcoming sessions, galleries by stage, new inquiries, reviews waiting, and this month's revenue. Start here for general questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "find_bookings",
    effect: "read",
    description: "Look up bookings (sessions). Filter by date range, status, client name/email, or only ones with a balance still owed. Returns each booking's id, client, session, time, status, total, amount still due, and whether a required contract is unsigned.",
    input_schema: {
      type: "object",
      properties: {
        from: DATE,
        to: DATE,
        status: { type: "string", enum: ["confirmed", "completed", "cancelled", "pending_payment", "any"] },
        client: { type: "string", description: "Part of a client's name or email." },
        balance_due_only: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_galleries",
    effect: "read",
    description: "Look up client galleries. Filter by stage, by galleries closing within N days, or by client. Returns each gallery's id, title, client, email, stage, photo counts, picks, close date, and review status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "submitted", "paid_and_submitted", "delivered", "completed", "expired", "any"] },
        closing_within_days: { type: "integer", minimum: 0, maximum: 365 },
        client: { type: "string", description: "Part of a client's name or email." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "find_clients",
    effect: "read",
    description: "Search the studio's clients by name or email. Returns id, name, email, phone, and how many bookings and galleries each has.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string" } },
      required: ["search"],
      additionalProperties: false,
    },
  },
  {
    name: "find_inquiries",
    effect: "read",
    description: "List inquiries (messages from potential clients), newest first, with the AI summary and whether they need the photographer personally.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["new", "replied", "converted", "archived", "any"] } },
      additionalProperties: false,
    },
  },
  {
    name: "revenue",
    effect: "read",
    description: "Money collected online between two dates (inclusive), split into bookings, gallery extras, and gift cards.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"], additionalProperties: false },
  },
  {
    name: "propose_client_email",
    effect: "external",
    description: "Prepare an email from the studio to existing clients (client_ids) and/or people who aren't clients yet (new_recipients, with the name and email the photographer gave; they're added as clients when approved). It is NOT sent: the photographer reviews and approves it. Write the message in the photographer's warm, professional voice, signed with the studio name. Use it for custom messages; use the other propose tools for gallery links, reminders, and review requests.",
    input_schema: {
      type: "object",
      properties: {
        client_ids: { type: "array", items: { type: "string" }, maxItems: 50 },
        new_recipients: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            properties: { name: { type: "string" }, email: { type: "string" } },
            required: ["name", "email"],
            additionalProperties: false,
          },
        },
        subject: { type: "string" },
        message: { type: "string", description: "The email body. Start with a greeting; use {first_name} to greet each client by name." },
      },
      required: ["subject", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_gallery_emails",
    effect: "external",
    description: "Prepare the studio's built-in gallery emails for approval: 'link' (the gallery link, or download link once delivered), 'closing_soon' (reminder that the gallery closes soon), or 'review_request' (ask for a review; delivered galleries only). Not sent until approved.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["link", "closing_soon", "review_request"] },
        gallery_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 50 },
      },
      required: ["kind", "gallery_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_balance_reminders",
    effect: "external",
    description: "Prepare the built-in balance-due reminder (with the client's pay link) for bookings that still owe money. Not sent until approved.",
    input_schema: {
      type: "object",
      properties: { booking_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 50 } },
      required: ["booking_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_booking_status",
    effect: "external",
    description: "Prepare a booking change for approval: mark sessions 'completed', or 'cancelled' (cancelling emails the client and frees the time). Nothing changes until approved.",
    input_schema: {
      type: "object",
      properties: {
        booking_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 50 },
        status: { type: "string", enum: ["completed", "cancelled"] },
      },
      required: ["booking_ids", "status"],
      additionalProperties: false,
    },
  },
];

// What goes to Claude (the API doesn't take `effect`).
export const ASSISTANT_TOOLS: Anthropic.Tool[] = TOOL_REGISTRY.map((spec) => {
  const tool: Partial<AssistantToolSpec> = { ...spec };
  delete tool.effect;
  return tool as Anthropic.Tool;
});

// A tool's effect, or null for a name that isn't a tool.
export function toolEffect(name: string): ToolEffect | null {
  return TOOL_REGISTRY.find((t) => t.name === name)?.effect ?? null;
}

// Tools that need the photographer's approval.
export const needsApproval = (name: string) => {
  const effect = toolEffect(name);
  return effect === "write" || effect === "external";
};
