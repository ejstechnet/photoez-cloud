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

export function galleryFinalsClient(g: GalleryFacts, o: { photoCount: number }): EmailContent {
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
    outro: [g.expires ? "Please download them before the gallery closes." : "Enjoy your photos!"],
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
