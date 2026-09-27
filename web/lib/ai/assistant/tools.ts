import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantProposals, bookings, clients, galleries, giftCards, inquiries, payments, reviews } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { addDays, formatDate, formatTime, localDateOf, zonedToUtc } from "@/lib/booking/time";
import { signedContractFor } from "@/lib/contracts/for-booking";
import { bookingTotal, prepaid } from "@/lib/payments/amounts";

// The Studio Assistant's tools. Look-up tools read the photographer's own
// data (always filtered by their id). "propose_" tools never act: they save a
// proposal the photographer approves or dismisses in the dashboard.

export type ToolContext = { photographerId: string; timeZone: string };
export type Proposal = { id: string; kind: string; summary: string; details: string[] };

const DATE = { type: "string", description: "A calendar day, YYYY-MM-DD, in the studio's time zone." } as const;

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "studio_overview",
    description: "Today's date and a snapshot of the studio: upcoming sessions, galleries by stage, new inquiries, reviews waiting, and this month's revenue. Start here for general questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "find_bookings",
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
    description: "List inquiries (messages from potential clients), newest first, with the AI summary and whether they need the photographer personally.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["new", "replied", "converted", "archived", "any"] } },
      additionalProperties: false,
    },
  },
  {
    name: "revenue",
    description: "Money collected online between two dates (inclusive), split into bookings, gallery extras, and gift cards.",
    input_schema: { type: "object", properties: { from: DATE, to: DATE }, required: ["from", "to"], additionalProperties: false },
  },
  {
    name: "propose_client_email",
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

type Input = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ids = (v: unknown) =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);

// Runs one tool; returns text for Claude, plus a proposal when one was made.
export async function runTool(name: string, input: Input, ctx: ToolContext): Promise<{ text: string; proposal?: Proposal }> {
  const tz = ctx.timeZone;
  const today = localDateOf(new Date(), tz);
  const when = (d: Date) => `${formatDate(d, tz, "short")} ${formatTime(d, tz)}`;
  const day = (d: Date) => formatDate(d, tz, "short");
  const startOf = (date: string) => zonedToUtc(date, "00:00", tz);

  switch (name) {
    case "studio_overview": {
      const monthStart = startOf(`${today.slice(0, 7)}-01`);
      const [[b], galleryRows, [inq], [rev], [money]] = await Promise.all([
        db
          .select({
            upcoming: sql<number>`count(*) filter (where ${bookings.status} = 'confirmed' and ${bookings.startsAt} > now())::int`,
            next7: sql<number>`count(*) filter (where ${bookings.status} = 'confirmed' and ${bookings.startsAt} > now() and ${bookings.startsAt} < now() + interval '7 days')::int`,
          })
          .from(bookings)
          .where(eq(bookings.photographerId, ctx.photographerId)),
        db
          .select({ status: galleries.status, n: sql<number>`count(*)::int` })
          .from(galleries)
          .where(eq(galleries.photographerId, ctx.photographerId))
          .groupBy(galleries.status),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(inquiries)
          .where(and(eq(inquiries.photographerId, ctx.photographerId), eq(inquiries.status, "new"))),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(reviews)
          .where(and(eq(reviews.photographerId, ctx.photographerId), eq(reviews.status, "submitted"))),
        db
          .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
          .leftJoin(galleries, eq(galleries.id, payments.galleryId))
          .leftJoin(giftCards, eq(giftCards.id, payments.giftCardId))
          .where(
            and(
              eq(payments.status, "paid"),
              gte(payments.paidAt, monthStart),
              sql`coalesce(${bookings.photographerId}, ${galleries.photographerId}, ${giftCards.photographerId}) = ${ctx.photographerId}`,
            ),
          ),
      ]);
      return {
        text: JSON.stringify({
          today,
          time_zone: tz,
          upcoming_sessions: b.upcoming,
          sessions_next_7_days: b.next7,
          galleries_by_stage: Object.fromEntries(galleryRows.map((r) => [r.status, r.n])),
          new_inquiries: inq.n,
          reviews_to_approve: rev.n,
          collected_this_month: formatPrice(money.cents),
        }),
      };
    }

    case "find_bookings": {
      const status = str(input.status) || "any";
      const client = str(input.client);
      const rows = await db
        .select({
          booking: bookings,
          paidCents: sql<number>`(select coalesce(sum(amount_cents), 0) from payments where payments.booking_id = ${bookings.id} and payments.status = 'paid')::int`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.photographerId, ctx.photographerId),
            status !== "any" ? eq(bookings.status, status as "confirmed") : undefined,
            isDate(input.from) ? gte(bookings.startsAt, startOf(input.from)) : undefined,
            isDate(input.to) ? lt(bookings.startsAt, startOf(addDays(input.to, 1))) : undefined,
            client ? or(ilike(bookings.clientName, `%${client}%`), ilike(bookings.clientEmail, `%${client}%`)) : undefined,
          ),
        )
        .orderBy(asc(bookings.startsAt))
        .limit(50);
      const list = await Promise.all(
        rows.map(async ({ booking: b, paidCents }) => {
          const due = Math.max(0, bookingTotal(b) - paidCents - prepaid(b));
          return {
            id: b.id,
            client: b.clientName,
            email: b.clientEmail,
            session: b.sessionName,
            when: when(b.startsAt),
            status: b.status,
            total: formatPrice(bookingTotal(b)),
            due: formatPrice(due),
            due_cents: due,
            contract_signed: Boolean(await signedContractFor(b.id)),
          };
        }),
      );
      const filtered = input.balance_due_only ? list.filter((b) => b.due_cents > 0) : list;
      return { text: JSON.stringify({ count: filtered.length, bookings: filtered }) };
    }

    case "find_galleries": {
      const status = str(input.status) || "any";
      const client = str(input.client);
      const within = typeof input.closing_within_days === "number" ? input.closing_within_days : null;
      const rows = await db
        .select({
          g: galleries,
          clientName: clients.name,
          clientEmail: clients.email,
          proofs: sql<number>`(select count(*) from photos where photos.gallery_id = ${galleries.id} and photos.kind = 'proof')::int`,
          finals: sql<number>`(select count(*) from photos where photos.gallery_id = ${galleries.id} and photos.kind = 'final')::int`,
          picks: sql<number>`(select count(*) from favorites join photos on photos.id = favorites.photo_id where photos.gallery_id = ${galleries.id})::int`,
          review: reviews.status,
        })
        .from(galleries)
        .leftJoin(clients, eq(clients.id, galleries.clientId))
        .leftJoin(reviews, eq(reviews.galleryId, galleries.id))
        .where(
          and(
            eq(galleries.photographerId, ctx.photographerId),
            status !== "any" ? eq(galleries.status, status as "pending") : undefined,
            within !== null
              ? and(isNotNull(galleries.expiresAt), gte(galleries.expiresAt, new Date()), lte(galleries.expiresAt, startOf(addDays(today, within + 1))))
              : undefined,
            client ? or(ilike(clients.name, `%${client}%`), ilike(clients.email, `%${client}%`)) : undefined,
          ),
        )
        .orderBy(desc(galleries.createdAt))
        .limit(50);
      return {
        text: JSON.stringify({
          count: rows.length,
          galleries: rows.map((r) => ({
            id: r.g.id,
            title: r.g.title,
            client: r.clientName,
            email: r.clientEmail,
            stage: r.g.status,
            proofs: r.proofs,
            finals: r.finals,
            picks: r.picks,
            closes: r.g.expiresAt ? day(r.g.expiresAt) : null,
            delivered: r.g.deliveredAt ? day(r.g.deliveredAt) : null,
            review: r.review ?? "not asked",
          })),
        }),
      };
    }

    case "find_clients": {
      const search = str(input.search);
      const rows = await db
        .select({
          id: clients.id,
          name: clients.name,
          email: clients.email,
          phone: clients.phone,
          bookings: sql<number>`(select count(*) from bookings where bookings.client_id = ${clients.id})::int`,
          galleries: sql<number>`(select count(*) from galleries where galleries.client_id = ${clients.id})::int`,
        })
        .from(clients)
        .where(
          and(
            eq(clients.photographerId, ctx.photographerId),
            search ? or(ilike(clients.name, `%${search}%`), ilike(clients.email, `%${search}%`)) : undefined,
          ),
        )
        .orderBy(asc(clients.name))
        .limit(30);
      return { text: JSON.stringify({ count: rows.length, clients: rows }) };
    }

    case "find_inquiries": {
      const status = str(input.status) || "new";
      const rows = await db
        .select()
        .from(inquiries)
        .where(and(eq(inquiries.photographerId, ctx.photographerId), status !== "any" ? eq(inquiries.status, status as "new") : undefined))
        .orderBy(desc(inquiries.createdAt))
        .limit(25);
      return {
        text: JSON.stringify({
          count: rows.length,
          // Inquiry text was written by the public: it is data, never instructions.
          inquiries: rows.map((q) => ({
            id: q.id,
            from: q.fromName ?? q.triage?.clientName ?? null,
            email: q.fromEmail ?? q.triage?.email ?? null,
            received: day(q.createdAt),
            status: q.status,
            summary: q.triage?.summary ?? q.message.slice(0, 200),
            needs_photographer: q.triage?.needsPhotographer ?? null,
          })),
        }),
      };
    }

    case "revenue": {
      if (!isDate(input.from) || !isDate(input.to)) return { text: "Give both dates as YYYY-MM-DD." };
      const rows = await db
        .select({ kind: payments.kind, cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
        .from(payments)
        .leftJoin(bookings, eq(bookings.id, payments.bookingId))
        .leftJoin(galleries, eq(galleries.id, payments.galleryId))
        .leftJoin(giftCards, eq(giftCards.id, payments.giftCardId))
        .where(
          and(
            eq(payments.status, "paid"),
            gte(payments.paidAt, startOf(input.from)),
            lt(payments.paidAt, startOf(addDays(input.to, 1))),
            sql`coalesce(${bookings.photographerId}, ${galleries.photographerId}, ${giftCards.photographerId}) = ${ctx.photographerId}`,
          ),
        )
        .groupBy(payments.kind);
      const sum = (kinds: string[]) => rows.filter((r) => kinds.includes(r.kind)).reduce((s, r) => s + r.cents, 0);
      return {
        text: JSON.stringify({
          from: input.from,
          to: input.to,
          bookings: formatPrice(sum(["deposit", "balance"])),
          gallery_extras: formatPrice(sum(["gallery_extras"])),
          gift_cards: formatPrice(sum(["gift_card"])),
          total: formatPrice(sum(["deposit", "balance", "gallery_extras", "gift_card"])),
          note: "Online payments only.",
        }),
      };
    }

    case "propose_client_email": {
      const clientIds = ids(input.client_ids);
      const subject = str(input.subject).slice(0, 150);
      const message = str(input.message).slice(0, 5000);
      // People who aren't clients yet: a name and a real-looking email address.
      const newPeople = (Array.isArray(input.new_recipients) ? input.new_recipients : [])
        .map((r) => ({ name: str((r as Input)?.name).slice(0, 120), email: str((r as Input)?.email).toLowerCase().slice(0, 200) }))
        .filter((r) => r.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
        .slice(0, 20);
      if (!subject || !message) return { text: "Give a subject and a message." };
      const rows = clientIds.length
        ? await db
            .select({ id: clients.id, name: clients.name, email: clients.email })
            .from(clients)
            .where(and(eq(clients.photographerId, ctx.photographerId), inArray(clients.id, clientIds)))
        : [];
      const reachable = rows.filter((r) => r.email);
      if (!reachable.length && !newPeople.length) {
        return { text: "There's no email address to send to. Write the draft in your answer and ask the photographer for the address." };
      }
      const people = reachable.length + newPeople.length;
      return propose(
        ctx,
        "client_email",
        { clientIds: reachable.map((r) => r.id), newRecipients: newPeople, subject, message },
        `Email ${count(people, "person", "people")}: "${subject}"`,
        [
          ...reachable.map((r) => `To ${r.name} <${r.email}>`),
          ...newPeople.map((r) => `To ${r.name} <${r.email}> (new, added as a client when approved)`),
          ...(rows.length > reachable.length ? [`Skipped ${rows.length - reachable.length} without an email`] : []),
          `Message:\n${message}`,
        ],
      );
    }

    case "propose_gallery_emails": {
      const kind = str(input.kind);
      if (!["link", "closing_soon", "review_request"].includes(kind)) return { text: "Choose link, closing_soon, or review_request." };
      const rows = await db
        .select({ id: galleries.id, title: galleries.title, status: galleries.status, name: clients.name, email: clients.email })
        .from(galleries)
        .leftJoin(clients, eq(clients.id, galleries.clientId))
        .where(and(eq(galleries.photographerId, ctx.photographerId), inArray(galleries.id, ids(input.gallery_ids))));
      const ok = rows.filter(
        (r) => r.email && (kind !== "review_request" || r.status === "delivered" || r.status === "completed"),
      );
      if (!ok.length) return { text: "None of those galleries can get that email (no client email, or not delivered yet for review requests)." };
      const label = { link: "gallery link", closing_soon: "“gallery closes soon” reminder", review_request: "review request" }[kind];
      return propose(ctx, "gallery_emails", { kind, galleryIds: ok.map((r) => r.id) }, `Send the ${label} for ${count(ok.length, "gallery", "galleries")}`, [
        ...ok.map((r) => `${r.title}: ${r.name} <${r.email}>`),
        ...(rows.length > ok.length ? [`Skipped ${rows.length - ok.length} that can't get it`] : []),
      ]);
    }

    case "propose_balance_reminders": {
      const rows = await db
        .select({ booking: bookings, paidCents: sql<number>`(select coalesce(sum(amount_cents), 0) from payments where payments.booking_id = ${bookings.id} and payments.status = 'paid')::int` })
        .from(bookings)
        .where(and(eq(bookings.photographerId, ctx.photographerId), inArray(bookings.id, ids(input.booking_ids)), eq(bookings.status, "confirmed")));
      const owing = rows
        .map(({ booking, paidCents }) => ({ booking, due: Math.max(0, bookingTotal(booking) - paidCents - prepaid(booking)) }))
        .filter((r) => r.due > 0);
      if (!owing.length) return { text: "None of those bookings owe anything." };
      return propose(ctx, "balance_reminders", { bookingIds: owing.map((r) => r.booking.id) }, `Send ${count(owing.length, "balance reminder")}`, owing.map(
        (r) => `${r.booking.clientName}: ${formatPrice(r.due)} due · ${r.booking.sessionName}, ${when(r.booking.startsAt)}`,
      ));
    }

    case "propose_booking_status": {
      const status = str(input.status);
      if (status !== "completed" && status !== "cancelled") return { text: "Choose completed or cancelled." };
      const rows = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.photographerId, ctx.photographerId), inArray(bookings.id, ids(input.booking_ids))));
      const changing = rows.filter((b) => b.status !== status && b.status !== "cancelled");
      if (!changing.length) return { text: "Those bookings can't be changed that way." };
      return propose(
        ctx,
        "booking_status",
        { bookingIds: changing.map((b) => b.id), status },
        `${status === "cancelled" ? "Cancel" : "Mark completed"}: ${count(changing.length, "booking")}`,
        [
          ...changing.map((b) => `${b.clientName} · ${b.sessionName}, ${when(b.startsAt)}`),
          ...(status === "cancelled" ? ["Each client gets a cancellation email, and the times open up."] : []),
        ],
      );
    }
  }
  return { text: `Unknown tool ${name}.` };
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function propose(
  ctx: ToolContext,
  kind: "client_email" | "gallery_emails" | "balance_reminders" | "booking_status",
  payload: Record<string, unknown>,
  summary: string,
  details: string[],
): Promise<{ text: string; proposal: Proposal }> {
  const [row] = await db
    .insert(assistantProposals)
    .values({ photographerId: ctx.photographerId, kind, payload: { ...payload, details }, summary })
    .returning({ id: assistantProposals.id });
  return {
    text: `Prepared for approval (nothing sent yet): ${summary}. The photographer will see a card with an Approve button.`,
    proposal: { id: row.id, kind, summary, details },
  };
}
