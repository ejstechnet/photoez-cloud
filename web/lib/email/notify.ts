import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingAddons, bookings, clients, favorites, galleries, inquiries, photographers, photos, storeOrderItems, storeOrders } from "@/db/schema";
import { trackingUrl } from "@/lib/store/rules";
import { formatDuration } from "@/lib/booking/format";
import { formatDate, formatTime, zoneLabel } from "@/lib/booking/time";
import { contractTemplateFor, signedContractFor } from "@/lib/contracts/for-booking";
import { amountPaid, bookingTotal } from "@/lib/payments/amounts";
import { bookingPayments } from "@/lib/payments/checkout";
import { siteUrl } from "@/lib/site";
import { clientReferralLink } from "@/lib/client-referrals";
import * as messages from "./messages";
import { sendToClient, sendToStudio } from "./send";
import * as texts from "@/lib/sms/messages";
import { textClient, textStudio } from "@/lib/sms/send";

// One function per moment an email goes out. Each loads what it needs, so
// callers just say what happened (usually through afterResponse()). The
// matching text message (lib/sms) goes out from here too, when the studio
// texts and the client agreed to texts.

export function formatWhen(instant: Date, timeZone: string) {
  return `${formatDate(instant, timeZone)} at ${formatTime(instant, timeZone)} ${zoneLabel(instant, timeZone)}`;
}

async function loadBooking(bookingId: string) {
  const [row] = await db
    .select({ booking: bookings, studio: photographers })
    .from(bookings)
    .innerJoin(photographers, eq(photographers.id, bookings.photographerId))
    .where(eq(bookings.id, bookingId));
  if (!row) return null;
  const { booking, studio } = row;

  const [extras, payments, template, signed] = await Promise.all([
    db
      .select({ name: bookingAddons.name, quantity: bookingAddons.quantity })
      .from(bookingAddons)
      .where(eq(bookingAddons.bookingId, booking.id)),
    bookingPayments(booking.id),
    contractTemplateFor(booking),
    signedContractFor(booking.id),
  ]);

  const manageUrl = `${siteUrl}/booking/${booking.manageToken}`;
  const facts: messages.BookingFacts = {
    studioName: studio.businessName || studio.name,
    clientName: booking.clientName,
    sessionName: booking.sessionName,
    when: formatWhen(booking.startsAt, studio.timeZone),
    length: formatDuration(Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000)),
    addons: extras.map((e) => (e.quantity > 1 ? `${e.name} × ${e.quantity}` : e.name)),
    totalCents: bookingTotal(booking),
    paidCents: amountPaid(payments, booking),
    manageUrl,
    contractUrl: template && !signed ? `${manageUrl}/contract` : null,
  };
  return {
    booking,
    studio,
    facts,
    signed,
    dashboardUrl: `${siteUrl}/dashboard/bookings/${booking.id}`,
  };
}

// ---- Bookings ----

// A booking is confirmed: right away when no deposit is taken, or when the
// deposit is paid. Emails the client and tells the studio.
export async function emailBookingConfirmed(bookingId: string) {
  const loaded = await loadBooking(bookingId);
  if (!loaded || loaded.booking.status !== "confirmed") return;
  const { booking, facts, dashboardUrl } = loaded;
  await sendToClient(booking.photographerId, "booking_confirmed", booking.clientEmail, messages.bookingConfirmedClient(facts), {
    bookingId,
  });
  await sendToStudio(
    booking.photographerId,
    "booking_new",
    messages.bookingNewStudio({
      ...facts,
      clientEmail: booking.clientEmail,
      clientPhone: booking.clientPhone,
      couponCode: booking.couponCode,
      dashboardUrl,
    }),
    { bookingId, replyTo: booking.clientEmail },
  );
  await textStudio(
    booking.photographerId,
    "booking_new",
    texts.newBookingAlert({ client: booking.clientName, session: booking.sessionName, when: facts.when, url: dashboardUrl }),
  );
}

export async function emailBookingCancelled(
  bookingId: string,
  by: "client" | "studio",
  credit: { cents: number; expiresOn: string | null },
) {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return;
  const { booking, studio, facts, dashboardUrl } = loaded;
  const late = by === "client" && credit.cents === 0 && !booking.creditDue && facts.paidCents > 0;
  const cancel: messages.CancelFacts = {
    by,
    creditCents: credit.cents,
    creditExpires: credit.expiresOn ? formatDate(new Date(`${credit.expiresOn}T12:00:00Z`), "UTC") : null,
    lateNoCredit: late,
    noticeHours: studio.cancelNoticeHours,
  };
  await sendToClient(
    booking.photographerId,
    "booking_cancelled",
    booking.clientEmail,
    messages.bookingCancelledClient(facts, cancel),
    { bookingId },
  );
  // The studio already knows when it cancelled.
  if (by === "client") {
    await sendToStudio(
      booking.photographerId,
      "booking_cancelled",
      messages.bookingCancelledStudio({ ...facts, dashboardUrl }, cancel),
      { bookingId, replyTo: booking.clientEmail },
    );
  }
}

// The client moved it (both are told), or the studio did (only the client is).
export async function emailBookingRescheduled(bookingId: string, oldStartsAt: Date, by: "client" | "studio" = "client") {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return;
  const { booking, studio, facts, dashboardUrl } = loaded;
  const oldWhen = formatWhen(oldStartsAt, studio.timeZone);
  await sendToClient(
    booking.photographerId,
    "booking_rescheduled",
    booking.clientEmail,
    messages.bookingRescheduledClient(facts, oldWhen),
    { bookingId },
  );
  if (by === "studio") return;
  await sendToStudio(
    booking.photographerId,
    "booking_rescheduled",
    messages.bookingRescheduledStudio({ ...facts, dashboardUrl }, oldWhen),
    { bookingId, replyTo: booking.clientEmail },
  );
}

export async function emailContractSigned(bookingId: string) {
  const loaded = await loadBooking(bookingId);
  if (!loaded || !loaded.signed) return;
  const { booking, facts, signed, dashboardUrl } = loaded;
  await sendToClient(
    booking.photographerId,
    "contract_signed",
    booking.clientEmail,
    messages.contractSignedClient(facts, `${facts.manageUrl}/contract`),
    { bookingId },
  );
  await sendToStudio(
    booking.photographerId,
    "contract_signed",
    messages.contractSignedStudio({ ...facts, dashboardUrl }, signed.signerName),
    { bookingId, replyTo: booking.clientEmail },
  );
}

// A balance payment (the deposit's receipt is the confirmation email).
export async function emailPaymentReceived(bookingId: string, amountCents: number) {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return;
  const { booking, facts } = loaded;
  await sendToClient(
    booking.photographerId,
    "payment_received",
    booking.clientEmail,
    messages.paymentReceivedClient(facts, amountCents),
    { bookingId },
  );
}

export async function emailSessionReminder(bookingId: string) {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return false;
  const { booking, studio, facts } = loaded;
  await textClient(booking.photographerId, "sessionReminder", "session_reminder", booking.clientPhone, (name) =>
    texts.sessionReminderText({ studio: name, client: booking.clientName, session: booking.sessionName, when: facts.when, url: facts.manageUrl }),
  );
  return sendToClient(
    booking.photographerId,
    "session_reminder",
    booking.clientEmail,
    messages.sessionReminderClient(facts, studio.stripeChargesEnabled ? facts.manageUrl : null),
    { bookingId },
  );
}

// Returns false when nothing is owed (so no reminder is needed).
export async function emailBalanceReminder(bookingId: string) {
  const loaded = await loadBooking(bookingId);
  if (!loaded || loaded.facts.totalCents - loaded.facts.paidCents <= 0) return false;
  const { booking, facts } = loaded;
  await textClient(booking.photographerId, "paymentDue", "balance_reminder", booking.clientPhone, (name) =>
    texts.paymentDueText({
      studio: name,
      client: booking.clientName,
      what: `${booking.sessionName} balance`,
      amountCents: facts.totalCents - facts.paidCents,
      due: null,
      url: facts.manageUrl,
    }),
  );
  return sendToClient(
    booking.photographerId,
    "balance_reminder",
    booking.clientEmail,
    messages.balanceReminderClient(facts, facts.manageUrl),
    { bookingId },
  );
}

// ---- Galleries ----

async function loadGallery(galleryId: string) {
  const [row] = await db
    .select({ gallery: galleries, studio: photographers, clientName: clients.name, clientEmail: clients.email, clientPhone: clients.phone })
    .from(galleries)
    .innerJoin(photographers, eq(photographers.id, galleries.photographerId))
    .leftJoin(clients, eq(clients.id, galleries.clientId))
    .where(eq(galleries.id, galleryId));
  if (!row) return null;
  const { gallery, studio } = row;
  const facts: messages.GalleryFacts = {
    studioName: studio.businessName || studio.name,
    clientName: row.clientName ?? "there",
    title: gallery.title,
    url: `${siteUrl}/g/${gallery.shareToken}`,
    expires: gallery.expiresAt ? formatDate(gallery.expiresAt, studio.timeZone) : null,
  };
  return {
    gallery,
    facts,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    dashboardUrl: `${siteUrl}/dashboard/galleries/${gallery.id}`,
  };
}

async function photoCount(galleryId: string, kind: "proof" | "final") {
  const [row] = await db
    .select({ n: count() })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, kind)));
  return row?.n ?? 0;
}

// The photographer's "Email link to client" button. Sends the proofing
// invitation, or the download email once the gallery is delivered.
export async function emailGalleryLink(galleryId: string): Promise<{ ok: true; to: string } | { error: string }> {
  const loaded = await loadGallery(galleryId);
  if (!loaded) return { error: "That gallery could not be found." };
  const { gallery, facts, clientEmail } = loaded;
  if (!clientEmail) return { error: "Add an email address for this client first." };
  const delivered = gallery.status === "delivered" || gallery.status === "completed";
  const sent = delivered
    ? await sendToClient(
        gallery.photographerId,
        "gallery_finals",
        clientEmail,
        messages.galleryFinalsClient(facts, {
          photoCount: await photoCount(galleryId, "final"),
          share: await clientReferralLink(gallery.photographerId, clientEmail),
        }),
        { galleryId },
      )
    : await sendToClient(
        gallery.photographerId,
        "gallery_link",
        clientEmail,
        messages.galleryProofsClient(facts, { photoCount: await photoCount(galleryId, "proof"), freeLimit: gallery.freeLimit }),
        { galleryId },
      );
  return sent || !process.env.SMTP_HOST ? { ok: true, to: clientEmail } : { error: "The email couldn't be sent. See the Email log." };
}

// Delivered: the client hears their finals are ready (when we have their email).
export async function emailFinalsReady(galleryId: string) {
  const loaded = await loadGallery(galleryId);
  if (!loaded) return;
  await textClient(loaded.gallery.photographerId, "galleryReady", "gallery_finals", loaded.clientPhone, (name) =>
    texts.galleryReadyText({ studio: name, client: loaded.facts.clientName, url: loaded.facts.url }),
  );
  if (!loaded.clientEmail) return;
  const { gallery, facts, clientEmail } = loaded;
  await sendToClient(
    gallery.photographerId,
    "gallery_finals",
    clientEmail,
    messages.galleryFinalsClient(facts, {
      photoCount: await photoCount(galleryId, "final"),
      share: await clientReferralLink(gallery.photographerId, clientEmail),
    }),
    { galleryId },
  );
}

export async function emailSelectionsSubmitted(galleryId: string) {
  const loaded = await loadGallery(galleryId);
  if (!loaded) return;
  const { gallery, facts, clientEmail, dashboardUrl } = loaded;
  const picks = await db
    .select({ note: favorites.note })
    .from(favorites)
    .innerJoin(photos, eq(photos.id, favorites.photoId))
    .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, "proof")));
  await sendToStudio(
    gallery.photographerId,
    "selections_submitted",
    messages.selectionsSubmittedStudio(
      { ...facts, dashboardUrl },
      {
        count: picks.length,
        extras: gallery.extrasCount,
        extrasCents: gallery.extrasCents,
        paid: gallery.status === "paid_and_submitted",
        notes: picks.filter((p) => p.note).length,
      },
    ),
    { galleryId, replyTo: clientEmail },
  );
}

export async function emailGalleryExpiring(galleryId: string) {
  const loaded = await loadGallery(galleryId);
  if (!loaded?.facts.expires) return false;
  const { gallery, facts, clientEmail } = loaded;
  const delivered = gallery.status === "delivered" || gallery.status === "completed";
  const texted = await textClient(gallery.photographerId, "galleryExpiring", "gallery_expiring", loaded.clientPhone, (name) =>
    texts.galleryExpiringText({ studio: name, client: facts.clientName, expires: facts.expires!, url: facts.url, delivered }),
  );
  if (!clientEmail) return texted;
  return sendToClient(
    gallery.photographerId,
    "gallery_expiring",
    clientEmail,
    messages.galleryExpiringClient({ ...facts, expires: facts.expires! }, delivered ? "delivered" : "proofing"),
    { galleryId },
  );
}

// ---- Inquiries ----

// Emails a reply to an inquiry and marks it replied.
export async function sendInquiryReply(
  inquiryId: string,
  body: string,
  auto: boolean,
): Promise<{ ok: true } | { error: string }> {
  const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId));
  if (!inquiry) return { error: "That inquiry could not be found." };
  const to = inquiry.triage?.email || inquiry.fromEmail;
  if (!to) return { error: "There's no email address to reply to." };
  const studio = await db
    .select({ name: photographers.name, businessName: photographers.businessName })
    .from(photographers)
    .where(eq(photographers.id, inquiry.photographerId));
  const studioName = studio[0]?.businessName || studio[0]?.name || "the studio";
  const sent = await sendToClient(inquiry.photographerId, "inquiry_reply", to, messages.inquiryReplyClient(studioName, body), {
    inquiryId,
  });
  if (!sent && process.env.SMTP_HOST) return { error: "The email couldn't be sent. See the Email log." };
  await db
    .update(inquiries)
    .set({ status: "replied", repliedAt: new Date(), autoReplied: auto })
    .where(eq(inquiries.id, inquiryId));
  return { ok: true };
}

// After triage of an inquiry from the studio page: send the AI's reply on
// its own when the studio allows it and the AI handled it, then tell the studio.
export async function handleNewInquiry(inquiryId: string) {
  const [row] = await db
    .select({ inquiry: inquiries, autoSend: photographers.autoSendReplies })
    .from(inquiries)
    .innerJoin(photographers, eq(photographers.id, inquiries.photographerId))
    .where(eq(inquiries.id, inquiryId));
  if (!row) return;
  const { inquiry } = row;
  const triage = inquiry.triage;

  let autoSent = false;
  if (row.autoSend && triage && !triage.needsPhotographer && triage.draftReply.trim() && (triage.email || inquiry.fromEmail)) {
    autoSent = "ok" in (await sendInquiryReply(inquiryId, triage.draftReply, true));
  }

  await sendToStudio(
    inquiry.photographerId,
    "inquiry_new",
    messages.newInquiryStudio({
      fromName: inquiry.fromName ?? triage?.clientName ?? null,
      fromEmail: inquiry.fromEmail ?? triage?.email ?? null,
      summary: triage?.summary ?? null,
      needsYou: triage ? (triage.needsPhotographer ? (triage.handoffNote ?? "Take a look.") : null) : "The AI couldn't read this one.",
      autoSent,
      message: inquiry.message,
      dashboardUrl: `${siteUrl}/dashboard/inquiries/${inquiry.id}`,
    }),
    { inquiryId, replyTo: inquiry.fromEmail ?? triage?.email ?? null },
  );
  await textStudio(
    inquiry.photographerId,
    "inquiry_new",
    texts.newInquiryAlert({
      from: inquiry.fromName ?? triage?.clientName ?? inquiry.fromEmail ?? "someone",
      summary: triage?.summary ?? null,
      url: `${siteUrl}/dashboard/inquiries/${inquiry.id}`,
    }),
  );
}


// ---- Client referrals ----

// The client who shared their link earned a credit (lib/client-referrals.ts).
export async function emailReferralCredit(o: {
  photographerId: string;
  to: string;
  clientName: string;
  friendName: string;
  amountCents: number;
  expiresOn: string | null;
}) {
  const [studio] = await db
    .select({ name: photographers.name, businessName: photographers.businessName, slug: photographers.studioSlug })
    .from(photographers)
    .where(eq(photographers.id, o.photographerId));
  if (!studio) return false;
  return sendToClient(
    o.photographerId,
    "referral_credit",
    o.to,
    messages.referralCreditClient({
      studioName: studio.businessName || studio.name,
      clientName: o.clientName,
      friendName: o.friendName,
      amountCents: o.amountCents,
      expires: o.expiresOn ? formatLocalDate(o.expiresOn) : null,
      bookUrl: studio.slug ? `${siteUrl}/studio/${studio.slug}/book` : null,
      share: await clientReferralLink(o.photographerId, o.to),
    }),
  );
}

// "2027-03-28" → "March 28, 2027".
function formatLocalDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// ---- Online Store ----

async function loadStoreOrder(orderId: string) {
  const [row] = await db
    .select({ order: storeOrders, studioName: photographers.businessName, name: photographers.name, token: galleries.shareToken })
    .from(storeOrders)
    .innerJoin(photographers, eq(photographers.id, storeOrders.photographerId))
    .leftJoin(galleries, eq(galleries.id, storeOrders.galleryId))
    .where(eq(storeOrders.id, orderId));
  if (!row) return null;
  const items = await db.select().from(storeOrderItems).where(eq(storeOrderItems.orderId, orderId));
  const { order } = row;
  const facts: messages.StoreOrderFacts = {
    studioName: row.studioName || row.name,
    clientName: order.clientName,
    orderNumber: order.orderNumber,
    items: items.map((i) => `${i.quantity} × ${i.productName} ${i.variantLabel}${i.photoName ? ` (${i.photoName})` : ""}`),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    handlingCents: order.handlingCents,
    totalCents: order.totalCents,
    shipTo: order.shipLine1
      ? [order.shipName, order.shipLine1, order.shipLine2, `${order.shipCity ?? ""}, ${order.shipState ?? ""} ${order.shipPostalCode ?? ""}`.trim()]
          .filter(Boolean)
          .join("\n")
      : null,
  };
  return { order, facts, galleryUrl: row.token ? `${siteUrl}/g/${row.token}` : null };
}

// A store order was paid: the client's receipt, and a heads-up to the studio.
// SwaggPress changed products the studio sells (lib/swaggpress/catalog.ts).
export async function emailSwaggChanges(photographerId: string, changes: messages.SwaggChangeLine[]) {
  const [studio] = await db.select({ name: photographers.name }).from(photographers).where(eq(photographers.id, photographerId));
  if (!studio || !changes.length) return;
  await sendToStudio(photographerId, "swaggpress_changes", messages.swaggChangesStudio({ name: studio.name, changes, storeUrl: `${siteUrl}/dashboard/store` }));
}

export async function emailStoreOrderPaid(orderId: string) {
  const loaded = await loadStoreOrder(orderId);
  if (!loaded) return;
  const { order, facts, galleryUrl } = loaded;
  if (order.clientEmail) {
    await sendToClient(order.photographerId, "store_order", order.clientEmail, messages.storeOrderClient({ ...facts, galleryUrl }), {
      galleryId: order.galleryId ?? undefined,
    });
  }
  await sendToStudio(
    order.photographerId,
    "store_order_new",
    messages.storeOrderStudio({ ...facts, dashboardUrl: `${siteUrl}/dashboard/store/orders/${order.id}` }),
  );
}

// One part of a store order shipped: the studio's own items ("self", marked
// shipped in the dashboard) or the items SwaggPress printed ("lab").
export async function emailStoreOrderShipped(orderId: string, part: "self" | "lab" = "self") {
  const loaded = await loadStoreOrder(orderId);
  const to = loaded?.order.clientEmail;
  if (!loaded || !to) return false;
  const { order, facts } = loaded;
  const carrier = part === "lab" ? order.labCarrier : order.carrier;
  const tracking = part === "lab" ? order.labTracking : order.trackingNumber;
  const partItems = await db
    .select()
    .from(storeOrderItems)
    .where(and(eq(storeOrderItems.orderId, orderId), eq(storeOrderItems.fulfillment, part === "lab" ? "swaggpress" : "self")));
  return sendToClient(
    order.photographerId,
    "store_order_shipped",
    to,
    messages.storeOrderShippedClient({
      ...facts,
      items: partItems.length
        ? partItems.map((i) => `${i.quantity} × ${i.productName} ${i.variantLabel}${i.photoName ? ` (${i.photoName})` : ""}`)
        : facts.items,
      carrier,
      trackingNumber: tracking,
      trackingUrl: trackingUrl(carrier, tracking),
    }),
    { galleryId: order.galleryId ?? undefined },
  );
}
