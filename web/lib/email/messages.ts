import { formatPrice } from "../booking/format.ts";
import { toParagraphs, type EmailContent } from "./layout.ts";

// The wording of every email, as pure functions of already-formatted facts
// (dates are formatted in the studio's time zone before they get here).
// Modeled on PhotoEZ for WordPress: booking, cancellation, reschedule,
// contract, gallery, and reminder emails, plus PhotoEZ Cloud's inquiry emails.

export type BookingFacts = {
  studioName: string;
  clientName: string;
  sessionName: string;
  // e.g. "Saturday, October 3, 2026 at 10:00 AM PDT"
  when: string;
  length: string;
  addons: string[];
  totalCents: number;
  paidCents: number;
  manageUrl: string;
  // Set when the session has a contract the client hasn't signed yet.
  contractUrl: string | null;
};

export type GalleryFacts = {
  studioName: string;
  clientName: string;
  title: string;
  url: string;
  // e.g. "Friday, November 6, 2026"; null = the gallery doesn't close.
  expires: string | null;
};

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function bookingDetails(b: BookingFacts): [string, string][] {
  const due = Math.max(0, b.totalCents - b.paidCents);
  const rows: [string, string][] = [
    ["Session", b.sessionName],
    ["When", b.when],
    ["Length", b.length],
  ];
  if (b.addons.length) rows.push(["Extras", b.addons.join("\n")]);
  rows.push(["Total", formatPrice(b.totalCents)]);
  if (b.paidCents > 0) rows.push(["Paid", formatPrice(b.paidCents)]);
  if (due > 0 && b.paidCents > 0) rows.push(["Balance", formatPrice(due)]);
  return rows;
}

// ---- Booking emails ----

export function bookingConfirmedClient(b: BookingFacts): EmailContent {
  return {
    subject: `Your session with ${b.studioName} is confirmed`,
    heading: "You're booked! 📸",
    intro: [`Hi ${firstName(b.clientName)}, thank you for booking with ${b.studioName}. Here are your session details:`],
    details: bookingDetails(b),
    button: b.contractUrl
      ? { label: "Sign your contract", url: b.contractUrl }
      : { label: "View my booking", url: b.manageUrl },
    outro: [
      b.contractUrl
        ? `Please sign your contract before your session. You can view, reschedule, or cancel your booking anytime here: ${b.manageUrl}`
        : "You can view, reschedule, or cancel your booking anytime from that page, following the studio's policy.",
    ],
  };
}

export function bookingNewStudio(
  b: BookingFacts & { clientEmail: string; clientPhone: string | null; couponCode: string | null; dashboardUrl: string },
): EmailContent {
  const rows = bookingDetails(b);
  rows.splice(0, 0, ["Client", [b.clientName, b.clientEmail, b.clientPhone].filter(Boolean).join("\n")]);
  if (b.couponCode) rows.push(["Coupon", b.couponCode]);
  return {
    subject: `New booking: ${b.clientName}, ${b.sessionName}`,
    heading: "New booking",
    intro: [`${b.clientName} just booked a ${b.sessionName} session.`],
    details: rows,
    button: { label: "Open booking", url: b.dashboardUrl },
    outro: ["Reply to this email to write to the client directly."],
  };
}

export type CancelFacts = {
  by: "client" | "studio";
  // Session credit the client got for cancelling early (0 = none).
  creditCents: number;
  creditExpires: string | null;
  // The client cancelled too late for a credit and had paid something.
  lateNoCredit: boolean;
  noticeHours: number;
};

export function bookingCancelledClient(b: BookingFacts, c: CancelFacts): EmailContent {
  const intro =
    c.by === "client"
      ? [`Hi ${firstName(b.clientName)}, your ${b.sessionName} session on ${b.when} has been cancelled, as you asked.`]
      : [`Hi ${firstName(b.clientName)}, ${b.studioName} has cancelled your ${b.sessionName} session on ${b.when}.`];
  const outro: string[] = [];
  if (c.creditCents > 0) {
    outro.push(
      `Good news: ${formatPrice(c.creditCents)} has been saved as a session credit${c.creditExpires ? `, good through ${c.creditExpires}` : ""}. Book again with this email address and you can put it toward your next session.`,
    );
  } else if (c.lateNoCredit) {
    outro.push(
      `Because it was cancelled less than ${c.noticeHours} hours before the session, the amount you paid isn't turned into a session credit, per the studio's policy.`,
    );
  } else if (c.by === "studio") {
    outro.push(`If you paid anything toward this session, ${b.studioName} will be in touch about it.`);
  }
  outro.push(`We'd love to see you another time. Just reply to this email to reach ${b.studioName}.`);
  return {
    subject: `Your ${b.sessionName} session has been cancelled`,
    heading: "Session cancelled",
    intro,
    details: [
      ["Session", b.sessionName],
      ["Was", b.when],
    ],
    outro,
  };
}

export function bookingCancelledStudio(b: BookingFacts & { dashboardUrl: string }, c: CancelFacts): EmailContent {
  return {
    subject: `${c.lateNoCredit ? "Late cancellation" : "Booking cancelled"}: ${b.clientName}, ${b.sessionName}`,
    heading: c.lateNoCredit ? "Late cancellation" : "Booking cancelled",
    intro: [
      `${b.clientName} cancelled their ${b.sessionName} session on ${b.when}.`,
      c.creditCents > 0
        ? `They cancelled early enough, so ${formatPrice(c.creditCents)} was saved as a session credit for them.`
        : c.lateNoCredit
          ? `It was less than ${c.noticeHours} hours before the session, so no session credit was given.`
          : "Nothing had been paid, so there's no credit to give.",
      "That time is open on your booking page again.",
    ],
    button: { label: "Open booking", url: b.dashboardUrl },
  };
}

export function bookingRescheduledClient(b: BookingFacts, oldWhen: string): EmailContent {
  return {
    subject: `Your ${b.sessionName} session has been moved`,
    heading: "Your session has a new time",
    intro: [`Hi ${firstName(b.clientName)}, your session with ${b.studioName} has been rescheduled.`],
    details: [
      ["Session", b.sessionName],
      ["New time", b.when],
      ["Was", oldWhen],
    ],
    button: { label: "View my booking", url: b.manageUrl },
  };
}

export function bookingRescheduledStudio(b: BookingFacts & { dashboardUrl: string }, oldWhen: string): EmailContent {
  return {
    subject: `Rescheduled: ${b.clientName}, ${b.sessionName}`,
    heading: "Booking rescheduled",
    intro: [`${b.clientName} moved their ${b.sessionName} session.`],
    details: [
      ["New time", b.when],
      ["Was", oldWhen],
    ],
    button: { label: "Open booking", url: b.dashboardUrl },
  };
}

export function contractSignedClient(b: BookingFacts, contractUrl: string): EmailContent {
  return {
    subject: `Your signed contract with ${b.studioName}`,
    heading: "Your contract is signed",
    intro: [
      `Hi ${firstName(b.clientName)}, thank you for signing your contract for your ${b.sessionName} session on ${b.when}.`,
      "You can view or print your signed copy anytime:",
    ],
    button: { label: "View my contract", url: contractUrl },
  };
}

export function contractSignedStudio(b: BookingFacts & { dashboardUrl: string }, signerName: string): EmailContent {
  return {
    subject: `Contract signed: ${b.clientName}, ${b.sessionName}`,
    heading: "Contract signed",
    intro: [`${signerName} signed the contract for the ${b.sessionName} session on ${b.when}.`],
    button: { label: "Open booking", url: b.dashboardUrl },
  };
}

export function paymentReceivedClient(b: BookingFacts, amountCents: number): EmailContent {
  const due = Math.max(0, b.totalCents - b.paidCents);
  return {
    subject: `Payment received: ${formatPrice(amountCents)} to ${b.studioName}`,
    heading: "Thank you for your payment",
    intro: [
      `Hi ${firstName(b.clientName)}, we received your payment of ${formatPrice(amountCents)} for your ${b.sessionName} session.`,
      due > 0 ? `Your remaining balance is ${formatPrice(due)}.` : "Your session is paid in full.",
    ],
    details: bookingDetails(b),
    button: { label: "View my booking", url: b.manageUrl },
  };
}

// ---- Reminders ----

export function sessionReminderClient(b: BookingFacts, payUrl: string | null): EmailContent {
  const due = Math.max(0, b.totalCents - b.paidCents);
  const outro: string[] = [];
  if (b.contractUrl) outro.push(`Your contract still needs your signature: ${b.contractUrl}`);
  if (due > 0) {
    outro.push(
      payUrl
        ? `Your balance of ${formatPrice(due)} is still due. You can pay it online here: ${payUrl}`
        : `Your balance of ${formatPrice(due)} is still due.`,
    );
  }
  outro.push(`Need to change something? Reply to this email to reach ${b.studioName}.`);
  return {
    subject: `Reminder: your ${b.sessionName} session is coming up`,
    heading: "See you soon!",
    intro: [`Hi ${firstName(b.clientName)}, this is a friendly reminder about your upcoming session with ${b.studioName}.`],
    details: bookingDetails(b),
    button: { label: "View my booking", url: b.manageUrl },
    outro,
  };
}

export function balanceReminderClient(b: BookingFacts, payUrl: string): EmailContent {
  const due = Math.max(0, b.totalCents - b.paidCents);
  return {
    subject: `Your balance of ${formatPrice(due)} is due before your session`,
    heading: "Balance due",
    intro: [
      `Hi ${firstName(b.clientName)}, your ${b.sessionName} session on ${b.when} is coming up, and your remaining balance of ${formatPrice(due)} is due.`,
    ],
    details: bookingDetails(b),
    button: { label: `Pay ${formatPrice(due)}`, url: payUrl },
    outro: [`Questions? Reply to this email to reach ${b.studioName}.`],
  };
}

// ---- Gallery emails ----

export function galleryProofsClient(g: GalleryFacts, o: { photoCount: number; freeLimit: number }): EmailContent {
  return {
    subject: `Your photos from ${g.studioName} are ready to view`,
    heading: "Your photos are ready! 🎉",
    intro: [
      `Hi ${firstName(g.clientName)}, your gallery "${g.title}" is ready. Take a look and pick your favorites.`,
      o.freeLimit > 0
        ? `Your package includes ${o.freeLimit} ${o.freeLimit === 1 ? "photo" : "photos"}. Tap the heart on the ones you love, then submit your picks.`
        : "Tap the heart on the ones you love, then submit your picks.",
    ],
    details: [
      ["Gallery", g.title],
      ["Photos", String(o.photoCount)],
      ...(g.expires ? ([["Open until", g.expires]] as [string, string][]) : []),
    ],
    button: { label: "Open my gallery", url: g.url },
    outro: ["This link is private to you, so please don't share it."],
  };
}

// The client's share-with-a-friend link (lib/client-referrals.ts), when the
// studio has client referrals on.
export type ShareFacts = { url: string; rewardCents: number; discountCents: number };

function shareLine(share: ShareFacts, studioName: string) {
  return `Know someone who'd love a session? Share your link and they get ${formatPrice(share.discountCents)} off their first session with ${studioName}. After their session, you get ${formatPrice(share.rewardCents)} toward your next one: ${share.url}`;
}

export function galleryFinalsClient(g: GalleryFacts, o: { photoCount: number; share?: ShareFacts | null }): EmailContent {
  return {
    subject: `Your final photos from ${g.studioName} are ready to download`,
    heading: "Your final photos are here!",
    intro: [
      `Hi ${firstName(g.clientName)}, your edited photos for "${g.title}" are ready. You can download them one at a time or all at once.`,
    ],
    details: [
      ["Gallery", g.title],
      ["Photos", String(o.photoCount)],
      ...(g.expires ? ([["Download by", g.expires]] as [string, string][]) : []),
    ],
    button: { label: "Download my photos", url: g.url },
    outro: [
      g.expires ? "Please download them before the gallery closes." : "Enjoy your photos!",
      ...(o.share ? [shareLine(o.share, g.studioName)] : []),
    ],
  };
}

export function galleryExpiringClient(g: GalleryFacts & { expires: string }, stage: "proofing" | "delivered"): EmailContent {
  return {
    subject: `Your gallery "${g.title}" closes soon`,
    heading: "Your gallery closes soon",
    intro: [
      stage === "delivered"
        ? `Hi ${firstName(g.clientName)}, a friendly reminder that your final photos from ${g.studioName} are available to download until ${g.expires}.`
        : `Hi ${firstName(g.clientName)}, a friendly reminder that your gallery from ${g.studioName} is open until ${g.expires}. Don't forget to submit your picks!`,
    ],
    button: { label: stage === "delivered" ? "Download my photos" : "Open my gallery", url: g.url },
  };
}

export function selectionsSubmittedStudio(
  g: GalleryFacts & { dashboardUrl: string },
  o: { count: number; extras: number; extrasCents: number; paid: boolean; notes: number },
): EmailContent {
  const intro = [`${g.clientName} submitted ${o.count} ${o.count === 1 ? "pick" : "picks"} for "${g.title}".`];
  if (o.extras > 0) {
    intro.push(
      `That includes ${o.extras} extra ${o.extras === 1 ? "photo" : "photos"} (${formatPrice(o.extrasCents)}), ${o.paid ? "paid online" : "not paid yet"}.`,
    );
  }
  if (o.notes > 0) intro.push(`They left ${o.notes} ${o.notes === 1 ? "note" : "notes"} on their picks.`);
  return {
    subject: `${g.clientName} submitted their picks: ${g.title}`,
    heading: "Selections submitted",
    intro,
    button: { label: "See their picks", url: g.dashboardUrl },
  };
}

// ---- Inquiry emails ----

export function inquiryReplyClient(studioName: string, body: string): EmailContent {
  return {
    subject: `Re: your message to ${studioName}`,
    intro: toParagraphs(body),
  };
}

export function newInquiryStudio(o: {
  fromName: string | null;
  fromEmail: string | null;
  summary: string | null;
  // Why it needs the photographer, or null when the AI handled it.
  needsYou: string | null;
  autoSent: boolean;
  message: string;
  dashboardUrl: string;
}): EmailContent {
  const who = o.fromName || o.fromEmail || "Someone";
  const status = o.needsYou
    ? `Needs you: ${o.needsYou}`
    : o.autoSent
      ? "Handled: the AI's reply was sent automatically."
      : "Handled: the AI's reply is ready for you to send.";
  const excerpt = o.message.length > 600 ? `${o.message.slice(0, 600).trimEnd()}…` : o.message;
  return {
    subject: `${o.needsYou ? "Needs you" : "New inquiry"}: ${who}`,
    heading: "New inquiry",
    intro: [o.summary ?? `${who} sent a message from your studio page.`, status],
    details: [
      ["From", [o.fromName, o.fromEmail].filter(Boolean).join("\n") || "Unknown"],
      ["Message", excerpt],
    ],
    button: { label: "Open inquiry", url: o.dashboardUrl },
  };
}

// ---- Account ----

export function passwordReset(name: string, url: string): EmailContent {
  return {
    subject: "Reset your PhotoEZ Cloud password",
    heading: "Reset your password",
    intro: [`Hi ${firstName(name)}, someone (hopefully you) asked to reset the password for your PhotoEZ Cloud account.`],
    button: { label: "Choose a new password", url },
    outro: ["This link works for one hour. If you didn't ask for this, you can ignore this email and your password stays the same."],
  };
}

// Sent at sign-up (and when an unconfirmed studio tries to log in): confirm
// the email address before the account can be used.
export function verifyEmail(name: string, url: string): EmailContent {
  return {
    subject: "Confirm your email for PhotoEZ Cloud",
    heading: "Confirm your email",
    intro: [`Hi ${firstName(name)}, welcome to PhotoEZ Cloud! Please confirm this is your email address to finish setting up your studio.`],
    button: { label: "Confirm my email", url },
    outro: ["This link works for 24 hours. If you didn't sign up for PhotoEZ Cloud, you can ignore this email."],
  };
}

// Sent 4 days and 1 day before a Free studio's Pro trial ends.
export function trialEndingStudio(o: {
  name: string;
  stage: "mid" | "final";
  daysLeft: number;
  endsOn: string;
  activeGalleries: number;
  storage: string;
  freeGalleries: number;
  freeStorage: string;
  overGalleries: boolean;
  overStorage: boolean;
  billingUrl: string;
  proMonthlyCents: number;
}): EmailContent {
  const days = o.daysLeft === 1 ? "1 day" : `${o.daysLeft} days`;
  const losing: string[] = [];
  if (o.overGalleries) {
    losing.push(`You have ${o.activeGalleries} active galleries; Free includes ${o.freeGalleries}. Nothing is deleted, but you couldn't add new ones until some are marked Completed.`);
  }
  if (o.overStorage) {
    losing.push(`You're using ${o.storage}; Free includes ${o.freeStorage}. Nothing is deleted, but you couldn't upload more.`);
  }
  return {
    subject: o.stage === "final" ? "Your PhotoEZ Cloud Pro trial ends tomorrow" : `Your PhotoEZ Cloud Pro trial has ${days} left`,
    heading: o.stage === "final" ? "Your Pro trial ends tomorrow" : `${days} left in your Pro trial`,
    intro: [
      `Hi ${firstName(o.name)}, your free Pro trial ends on ${o.endsOn}. After that your studio moves to the Free plan unless you choose one. Nothing is deleted either way.`,
      "Free keeps your studio page, booking, contracts, proofing galleries, payments, reviews, and AI culling. Pro adds unlimited galleries, gallery sales, 150 GB of storage, and far more AI gallery search and Studio Assistant questions.",
      ...losing,
    ],
    details: [
      ["Active galleries", String(o.activeGalleries)],
      ["Storage used", o.storage],
      ["Pro", `${formatPrice(o.proMonthlyCents)}/month, or two months free when billed yearly`],
    ],
    button: { label: "Keep Pro", url: o.billingUrl },
    outro: ["No card is on file, so you won't be charged unless you choose a plan."],
  };
}

export function testEmail(studioName: string): EmailContent {
  return {
    subject: `Test email from ${studioName}`,
    heading: "Email is working 🎉",
    intro: [
      "This is a test from PhotoEZ Cloud. If you're reading it, your studio's emails are being delivered.",
      "Tip: if this landed in spam, mark it as \"Not spam\" so future emails arrive in your inbox.",
    ],
  };
}

// ---- Reviews ----

export function reviewRequestClient(o: { studioName: string; clientName: string; galleryTitle: string | null; url: string }): EmailContent {
  return {
    subject: `How were your photos? ${o.studioName} would love your review`,
    heading: "How did we do?",
    intro: [
      `Hi ${firstName(o.clientName)}, thank you for choosing ${o.studioName}. It was a pleasure working with you.`,
      `${o.galleryTitle ? `Now that you have your photos from "${o.galleryTitle}", w` : "W"}e'd love to hear what you think. It only takes a minute, and it helps other clients find us.`,
    ],
    button: { label: "Leave a review", url: o.url },
    outro: ["You can add one of your favorite photos to your review too, if you'd like."],
  };
}

export function reviewSubmittedStudio(o: {
  clientName: string;
  rating: number;
  body: string;
  withPhoto: boolean;
  dashboardUrl: string;
}): EmailContent {
  const stars = "★".repeat(o.rating) + "☆".repeat(5 - o.rating);
  return {
    subject: `New ${o.rating}-star review from ${o.clientName}`,
    heading: "You have a new review",
    intro: [
      `${o.clientName} left a review${o.withPhoto ? " with one of their photos" : ""}. It won't show on your studio page until you approve it.`,
    ],
    details: [
      ["Rating", stars],
      ["Review", o.body.length > 600 ? `${o.body.slice(0, 600).trimEnd()}…` : o.body],
    ],
    button: { label: "Review and approve", url: o.dashboardUrl },
  };
}

// ---- Gift cards ----

export type GiftCardFacts = {
  studioName: string;
  code: string;
  amountCents: number;
  recipientName: string;
  buyerName: string | null;
  message: string | null;
  bookUrl: string;
};

export function giftCardRecipient(g: GiftCardFacts): EmailContent {
  const from = g.buyerName ? `${g.buyerName} sent you` : "You've received";
  return {
    subject: `${g.buyerName ? `${g.buyerName} sent you` : "You've received"} a ${formatPrice(g.amountCents)} gift card to ${g.studioName}`,
    heading: "You've got a gift! 🎁",
    intro: [
      `Hi ${firstName(g.recipientName)}, ${from} a ${formatPrice(g.amountCents)} gift card for a photo session with ${g.studioName}.`,
      ...(g.message ? [`“${g.message}”${g.buyerName ? ` — ${g.buyerName}` : ""}`] : []),
    ],
    details: [
      ["Gift card code", g.code],
      ["Value", formatPrice(g.amountCents)],
    ],
    button: { label: "Book a session", url: g.bookUrl },
    outro: [
      "Enter your code when you book. If your session costs less, the rest stays on your card for next time.",
      `Questions? Reply to this email to reach ${g.studioName}.`,
    ],
  };
}

export function giftCardReceipt(g: GiftCardFacts & { recipientEmail: string; deliverOn: string | null }): EmailContent {
  return {
    subject: `Your ${formatPrice(g.amountCents)} gift card to ${g.studioName}`,
    heading: "Thank you for your gift!",
    intro: [
      g.deliverOn
        ? `Your gift card for ${g.recipientName} will be emailed to ${g.recipientEmail} on ${g.deliverOn}.`
        : `Your gift card has been emailed to ${g.recipientName} at ${g.recipientEmail}.`,
      "Here are the details, in case you'd like to print it or share it yourself:",
    ],
    details: [
      ["Gift card code", g.code],
      ["Value", formatPrice(g.amountCents)],
      ["For", g.recipientName],
      ...(g.message ? ([["Your message", g.message]] as [string, string][]) : []),
    ],
    button: { label: `Visit ${g.studioName}`, url: g.bookUrl },
  };
}

export function giftCardSoldStudio(g: GiftCardFacts & { dashboardUrl: string }): EmailContent {
  return {
    subject: `Gift card sold: ${formatPrice(g.amountCents)}${g.buyerName ? ` from ${g.buyerName}` : ""}`,
    heading: "You sold a gift card",
    intro: [`${g.buyerName ?? "Someone"} bought a ${formatPrice(g.amountCents)} gift card for ${g.recipientName}.`],
    details: [
      ["Code", g.code],
      ["Value", formatPrice(g.amountCents)],
    ],
    button: { label: "See gift cards", url: g.dashboardUrl },
  };
}

// ---- A message the photographer wrote (or approved from the Studio Assistant) ----

export function studioMessage(subject: string, body: string): EmailContent {
  return { subject, intro: toParagraphs(body) };
}

// ---- Client referrals ----

export function referralCreditClient(o: {
  studioName: string;
  clientName: string;
  friendName: string;
  amountCents: number;
  expires: string | null;
  bookUrl: string | null;
  share: ShareFacts | null;
}): EmailContent {
  return {
    subject: `You earned ${formatPrice(o.amountCents)} toward your next session with ${o.studioName}`,
    heading: "Thank you for the referral! 🎉",
    intro: [
      `Hi ${firstName(o.clientName)}, ${firstName(o.friendName)} just had their session with ${o.studioName}, thanks to you. As a thank-you, you have ${formatPrice(o.amountCents)} of credit toward your next session.`,
      "It's saved under this email address and comes off automatically when you book with it.",
    ],
    details: [
      ["Credit", formatPrice(o.amountCents)],
      ...(o.expires ? ([["Use by", o.expires]] as [string, string][]) : []),
    ],
    ...(o.bookUrl ? { button: { label: "Book a session", url: o.bookUrl } } : {}),
    outro: o.share ? [shareLine(o.share, o.studioName)] : [],
  };
}

// ---- Online Store ----

export type StoreOrderFacts = {
  studioName: string;
  clientName: string | null;
  orderNumber: string;
  items: string[];
  subtotalCents: number;
  shippingCents: number;
  handlingCents: number;
  totalCents: number;
  shipTo: string | null;
};

function storeOrderDetails(o: StoreOrderFacts): [string, string][] {
  return [
    ["Order", o.orderNumber],
    ["Items", o.items.join("\n")],
    ["Subtotal", formatPrice(o.subtotalCents)],
    ...(o.shippingCents > 0 ? ([["Shipping", formatPrice(o.shippingCents)]] as [string, string][]) : []),
    ...(o.handlingCents > 0 ? ([["Handling", formatPrice(o.handlingCents)]] as [string, string][]) : []),
    ["Total paid", formatPrice(o.totalCents)],
    ...(o.shipTo ? ([["Ship to", o.shipTo]] as [string, string][]) : []),
  ];
}

export function storeOrderClient(o: StoreOrderFacts & { galleryUrl: string | null }): EmailContent {
  return {
    subject: `Your order from ${o.studioName} (${o.orderNumber})`,
    heading: "Thank you for your order!",
    intro: [
      `Hi ${o.clientName ? firstName(o.clientName) : "there"}, ${o.studioName} has your order and will get it made. We'll email you again when it ships.`,
    ],
    details: storeOrderDetails(o),
    ...(o.galleryUrl ? { button: { label: "Back to my gallery", url: o.galleryUrl } } : {}),
  };
}

export function storeOrderStudio(o: StoreOrderFacts & { dashboardUrl: string }): EmailContent {
  return {
    subject: `New store order ${o.orderNumber}: ${formatPrice(o.totalCents)}`,
    heading: "You have a new order 🛍️",
    intro: [`${o.clientName ?? "A client"} just ordered from their gallery. Download the print files and mark it shipped when it's on its way.`],
    details: storeOrderDetails(o),
    button: { label: "Open the order", url: o.dashboardUrl },
  };
}

export function storeOrderShippedClient(
  o: Pick<StoreOrderFacts, "studioName" | "clientName" | "orderNumber" | "items"> & {
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  },
): EmailContent {
  return {
    subject: `Your order from ${o.studioName} has shipped (${o.orderNumber})`,
    heading: "Your order is on its way! 📦",
    intro: [`Hi ${o.clientName ? firstName(o.clientName) : "there"}, your order from ${o.studioName} has shipped.`],
    details: [
      ["Order", o.orderNumber],
      ["Items", o.items.join("\n")],
      ...(o.carrier ? ([["Carrier", o.carrier]] as [string, string][]) : []),
      ...(o.trackingNumber ? ([["Tracking", o.trackingNumber]] as [string, string][]) : []),
    ],
    ...(o.trackingUrl ? { button: { label: "Track my package", url: o.trackingUrl } } : {}),
  };
}
