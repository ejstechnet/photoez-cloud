import {
  pgTable,
  uuid,
  text,
  boolean,
  doublePrecision,
  integer,
  timestamp,
  index,
  jsonb,
  unique,
  date,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { TriageResult } from "../lib/ai/triage";
import { BOOKING_FIELD_TYPES, type BookingAnswer } from "../lib/booking/fields";
import { BOOKING_STATUSES } from "../lib/booking/status";
import { PLANS } from "../lib/plans";
import { GALLERY_STATUSES } from "../lib/gallery-status";
import { PHOTO_KINDS } from "../lib/photo-limits";
import { WATERMARK_POSITIONS } from "../lib/watermark";

// A photographer's account. Better Auth uses this as its user table
// (see lib/auth.ts), so name, email, emailVerified, image, createdAt and
// updatedAt are the fields it expects.
export const photographers = pgTable("photographers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  businessName: text("business_name"),
  // Watermark for proofs, applied the same way as PhotoEZ for WordPress:
  // 55% of the photo's width, at this opacity, in this position.
  watermarkKey: text("watermark_key"),
  watermarkOpacity: integer("watermark_opacity").notNull().default(60),
  watermarkPosition: text("watermark_position", { enum: WATERMARK_POSITIONS }).notNull().default("center"),
  // When any watermark setting last changed; proofs made before this are stale.
  watermarkUpdatedAt: timestamp("watermark_updated_at", { withTimezone: true }),
  // Studio profile: the public studio page (/studio/<studioSlug>) and the
  // context AI triage uses when drafting replies.
  studioSlug: text("studio_slug").unique(),
  studioLogoKey: text("studio_logo_key"),
  // The photographer's own photo, shown in About on the studio page.
  headshotKey: text("headshot_key"),
  // The Page Designer's choices (lib/design.ts); null = PhotoEZ Cloud's own look.
  design: jsonb("design").$type<Partial<import("../lib/design").Design>>(),
  // Card color behind the logo on the studio page: a hex color or "transparent".
  studioLogoBg: text("studio_logo_bg").notNull().default("#ffffff"),
  studioTagline: text("studio_tagline"),
  studioBio: text("studio_bio"),
  serviceArea: text("service_area"),
  offeredTypes: jsonb("offered_types").$type<string[]>().notNull().default([]),
  shootLocations: jsonb("shoot_locations").$type<string[]>().notNull().default([]),
  // Services that need a quote instead of regular booking (e.g. events, product work).
  quoteOnlyTypes: jsonb("quote_only_types").$type<string[]>().notNull().default([]),
  // Booking settings. Weekly hours are wall-clock times in this time zone.
  timeZone: text("time_zone").notNull().default("America/Los_Angeles"),
  minNoticeDays: integer("min_notice_days").notNull().default(1),
  // Client self-service from their booking link.
  clientChangesEnabled: boolean("client_changes_enabled").notNull().default(true),
  rescheduleNoticeHours: integer("reschedule_notice_hours").notNull().default(48),
  freeReschedules: integer("free_reschedules").notNull().default(1),
  // Cancelling earlier than this turns the deposit into a session credit.
  cancelNoticeHours: integer("cancel_notice_hours").notNull().default(72),
  // Inspiration photos on the booking form: off, optional, or required.
  inspoMode: text("inspo_mode", { enum: ["off", "optional", "required"] }).notNull().default("optional"),
  // The photographer's own Stripe account (Stripe Connect). Client payments
  // go straight to it; chargesEnabled is Stripe's "ready to take payments".
  stripeAccountId: text("stripe_account_id"),
  stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
  // Subscription tier (lib/plans.ts): set from the Stripe subscription
  // (lib/billing.ts), or by hand for complimentary accounts.
  plan: text("plan", { enum: PLANS }).notNull().default("free"),
  // New sign-ups get Pro free until this moment (no card needed).
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  // When the "trial ending" emails went out (lib/trial-reminders.ts), so each
  // is sent once.
  trialMidReminderSentAt: timestamp("trial_mid_reminder_sent_at", { withTimezone: true }),
  trialFinalReminderSentAt: timestamp("trial_final_reminder_sent_at", { withTimezone: true }),
  // The studio's PhotoEZ Cloud subscription, on the PhotoEZ Cloud Stripe
  // account (not the studio's own connected account).
  billingCustomerId: text("billing_customer_id"),
  subscriptionId: text("subscription_id"),
  // Stripe's status: active, trialing, past_due, canceled, …
  subscriptionStatus: text("subscription_status"),
  planInterval: text("plan_interval", { enum: ["month", "year"] }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  // Studio plan: hide "Powered by PhotoEZ Cloud" on the studio's pages.
  hideBranding: boolean("hide_branding").notNull().default(false),
  // Photographer directory (/photographers): opted in, and where the studio
  // is. City, state, and map position come from the ZIP (lib/geo/zips.ts).
  directoryListed: boolean("directory_listed").notNull().default(false),
  directoryZip: text("directory_zip"),
  directoryCity: text("directory_city"),
  directoryState: text("directory_state"),
  directoryLat: doublePrecision("directory_lat"),
  directoryLng: doublePrecision("directory_lng"),
  // Photographer referrals (lib/referrals.ts): this studio's link code
  // (/r/<code>), and who referred this studio, if anyone.
  referralCode: text("referral_code").unique(),
  referredById: uuid("referred_by_id"),
  // Client referrals (lib/client-referrals.ts): the studio's clients share a
  // link; a friend's first session gets a discount, and once it has happened
  // the client who shared gets a session credit.
  clientReferralsEnabled: boolean("client_referrals_enabled").notNull().default(false),
  clientReferralRewardCents: integer("client_referral_reward_cents").notNull().default(2500),
  clientReferralDiscountCents: integer("client_referral_discount_cents").notNull().default(2500),
  // Online Store (lib/store): clients order prints and products of their
  // photos from delivered galleries. Shipping is a flat amount per order for
  // items the studio sends itself; handling is an optional extra per order.
  storeEnabled: boolean("store_enabled").notNull().default(false),
  storeShippingCents: integer("store_shipping_cents").notNull().default(0),
  storeHandlingCents: integer("store_handling_cents").notNull().default(0),
  // SwaggPress Creations, the store's print and merch partner (lib/swaggpress):
  // the studio's partner API key, sealed (lib/secret-box.ts), and what we
  // last heard about the partner account.
  swaggpressKey: text("swaggpress_key"),
  swaggpressBusiness: text("swaggpress_business"),
  swaggpressCardOnFile: boolean("swaggpress_card_on_file").notNull().default(false),
  swaggpressSyncedAt: timestamp("swaggpress_synced_at", { withTimezone: true }),
  // Price per photo a client selects beyond a gallery's included number
  // (PhotoEZ's "global extra price"; galleries can override it).
  extraPhotoPriceCents: integer("extra_photo_price_cents").notNull().default(1000),
  // Clients can leave a note on each photo they pick (galleries can override).
  photoNotesEnabled: boolean("photo_notes_enabled").notNull().default(true),
  // How long new session credits last, in months; null = they never expire.
  creditValidMonths: integer("credit_valid_months").default(12),
  // Email: where studio notices go (null = the account email), and whether the
  // AI's replies to inquiries it fully handled go out on their own.
  notifyEmail: text("notify_email"),
  autoSendReplies: boolean("auto_send_replies").notNull().default(false),
  // Automatic reminders, like PhotoEZ for WordPress; null turns one off.
  sessionReminderHours: integer("session_reminder_hours").default(24),
  balanceReminderDays: integer("balance_reminder_days").default(2),
  galleryExpiryReminderDays: integer("gallery_expiry_reminder_days").default(3),
  // Reviews (like PhotoEZ Reviews): ask this many days after delivery
  // (null = don't ask automatically), and an optional Google review link
  // offered to happy reviewers after they submit.
  reviewRequestDays: integer("review_request_days").default(3),
  googleReviewUrl: text("google_review_url"),
  // Gift cards clients can buy on the studio page: on/off, the preset amounts
  // offered, and the range for a custom amount (null = no custom amount).
  giftCardsEnabled: boolean("gift_cards_enabled").notNull().default(false),
  giftCardAmounts: jsonb("gift_card_amounts").$type<number[]>().notNull().default([5000, 10000, 25000]),
  giftCardMinCents: integer("gift_card_min_cents").default(2500),
  giftCardMaxCents: integer("gift_card_max_cents").default(100000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Better Auth tables ----

// A logged-in browser. The token is stored in the session cookie.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// A way to log in. For email and password, `password` holds the hash,
// never the password itself. Sign-in with Google etc. would add more rows.
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

// Short-lived codes, e.g. for email verification or password resets.
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ---- App tables ----

// A photographer's client. Deleting a photographer deletes their clients.
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    // This client's share-with-a-friend link code (/studio/<slug>/friend/<code>).
    referralCode: text("referral_code").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_photographer_idx").on(t.photographerId)],
);

// A set of photos delivered to one client through a private share link.
export const galleries = pgTable(
  "galleries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    // The booking this gallery was made for (lib/booking-gallery.ts); one
    // gallery per booking.
    bookingId: uuid("booking_id")
      .unique()
      .references((): AnyPgColumn => bookings.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    // What kind of shoot it is, for store products limited to some session
    // types. Set from the booking, or picked in the gallery's settings; null
    // falls back to the booking's session type.
    sessionTypeId: uuid("session_type_id").references((): AnyPgColumn => sessionTypes.id, { onDelete: "set null" }),
    // Random, unguessable token used in the client's gallery link.
    shareToken: text("share_token").notNull().unique(),
    // Same stages as PhotoEZ for WordPress (see lib/gallery-status.ts).
    status: text("status", { enum: GALLERY_STATUSES }).notNull().default("pending"),
    // How many photos the client may pick for free (the "0/10 Selected" counter).
    freeLimit: integer("free_limit").notNull().default(10),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // When the "your gallery closes soon" reminder went out.
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", { withTimezone: true }),
    // Large photo across the top of the client's gallery page (a storage key).
    headerImageKey: text("header_image_key"),
    // This gallery's price per extra photo; null uses the studio's price.
    extraPhotoPriceCents: integer("extra_photo_price_cents"),
    // Client notes on picks for this gallery; null uses the studio setting.
    notesEnabled: boolean("notes_enabled"),
    // Extra photos the client chose past freeLimit when they submitted, and
    // what they cost (paid through Stripe, or owed when it isn't connected).
    extrasCount: integer("extras_count").notNull().default(0),
    extrasCents: integer("extras_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("galleries_photographer_idx").on(t.photographerId),
    index("galleries_client_idx").on(t.clientId),
  ],
);

// Each time a client downloads from their delivery page: the whole ZIP
// ("all") or one photo. Photographer previews aren't recorded.
export const galleryDownloads = pgTable(
  "gallery_downloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["all", "photo"] }).notNull(),
    photoId: uuid("photo_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gallery_downloads_gallery_idx").on(t.galleryId, t.createdAt)],
);

// One uploaded photo. The image files live in R2 storage (see lib/storage.ts);
// `fileKey` is the storage prefix holding its original, preview and thumbnail.
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    // "proof": shown to the client while choosing favorites (watermarked).
    // "final": the edited photos delivered at the end (clean, downloadable).
    // Matches _photoez_gallery_images and _photoez_final_images in PhotoEZ for WordPress.
    kind: text("kind", { enum: PHOTO_KINDS }).notNull().default("proof"),
    fileKey: text("file_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull().default("image/jpeg"),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    // Display order within the gallery.
    position: integer("position").notNull().default(0),
    // When the watermarked proof was last made (null = no proof yet).
    proofMadeAt: timestamp("proof_made_at", { withTimezone: true }),
    // Culling help's measurements (lib/culling.ts); null = not checked yet.
    cull: jsonb("cull").$type<import("../lib/culling").CullMetrics>(),
    // Gallery search: what the AI saw in the photo (lib/ai/photo-tags.ts).
    aiDescription: text("ai_description"),
    aiTags: jsonb("ai_tags").$type<string[]>(),
    aiTaggedAt: timestamp("ai_tagged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_gallery_idx").on(t.galleryId, t.kind, t.position)],
);

// The studio's answers to common client questions (payment plans, what to
// wear, turnaround…). Shown on the public studio page, and the source AI
// triage answers from, so clients get answers without back-and-forth.
export const studioFaqs = pgTable(
  "studio_faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("studio_faqs_photographer_idx").on(t.photographerId, t.sortOrder)],
);

// Contract templates (like PhotoEZ Photography Contracts): formatted text with
// {{PLACEHOLDERS}} filled from the booking. One is the studio default.
export const contractTemplates = pgTable(
  "contract_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contract_templates_photographer_idx").on(t.photographerId)],
);

// ---- Booking (modeled on PhotoEZ Booking for WordPress) ----
// One photographer per studio for now. Extra photographers may come later as
// a paid add-on; these tables would then gain a photographer/member column.

// A bookable session the studio offers, e.g. "Mini maternity session".
export const sessionTypes = pgTable(
  "session_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    // Money is stored in cents, so $150.00 is 15000, avoiding rounding errors.
    priceCents: integer("price_cents").notNull(),
    // Share of the price due at booking (collected once deposits arrive in phase 2).
    depositPercent: integer("deposit_percent").notNull().default(100),
    // Special price: shown with the regular price struck through, until the
    // end date (studio's own calendar day, inclusive) or forever if none.
    salePriceCents: integer("sale_price_cents"),
    saleEndsOn: date("sale_ends_on"),
    location: text("location"),
    photosIncluded: integer("photos_included"),
    // Like PhotoEZ Booking's gallery_type: "proofing" makes a gallery for each
    // booking once it's confirmed (lib/booking-gallery.ts); "none" for
    // sessions with nothing to deliver, like consultations.
    galleryType: text("gallery_type", { enum: ["proofing", "none"] }).notNull().default("proofing"),
    // Photo shown above the session on the booking page (a storage key).
    imageKey: text("image_key"),
    // Contract signed after booking: the studio's default (null), a chosen
    // template, or none at all (noContract).
    contractTemplateId: uuid("contract_template_id").references(() => contractTemplates.id, { onDelete: "set null" }),
    noContract: boolean("no_contract").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("session_types_photographer_idx").on(t.photographerId, t.sortOrder)],
);

// Weekly working hours: one window per day of the week (0 = Sunday), like the plugin.
export const bookingHours = pgTable(
  "booking_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: text("start_time").notNull(), // "09:00"
    endTime: text("end_time").notNull(), // "17:00"
    bufferMinutes: integer("buffer_minutes").notNull().default(15),
  },
  (t) => [unique("booking_hours_day_unique").on(t.photographerId, t.dayOfWeek)],
);

// Days off: a single day or a range (vacations, holidays).
export const blackoutDates = pgTable(
  "blackout_dates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    note: text("note"),
  },
  (t) => [index("blackout_dates_photographer_idx").on(t.photographerId, t.startDate)],
);

// Extras a client can add to a booking (more edited photos, prints…), like
// PhotoEZ Booking's add-ons. A studio keeps one list and attaches add-ons to
// sessions; a session can include some for free (e.g. 15 edited photos).
export const addons = pgTable(
  "addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Price per one, in cents.
    priceCents: integer("price_cents").notNull(),
    // Most a client can add to one booking.
    maxQuantity: integer("max_quantity").notNull().default(10),
    imageKey: text("image_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("addons_photographer_idx").on(t.photographerId, t.sortOrder)],
);

// Which add-ons a session offers, and how many of each come with it.
export const sessionTypeAddons = pgTable(
  "session_type_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionTypeId: uuid("session_type_id")
      .notNull()
      .references(() => sessionTypes.id, { onDelete: "cascade" }),
    addonId: uuid("addon_id")
      .notNull()
      .references(() => addons.id, { onDelete: "cascade" }),
    includedQuantity: integer("included_quantity").notNull().default(0),
  },
  (t) => [unique("session_type_addons_unique").on(t.sessionTypeId, t.addonId)],
);

// A booked session. Times are exact instants; the session's name, price, and
// deposit are copied in so later edits to the session type don't rewrite history.
// Migration 0009 adds a database rule that no two active bookings overlap.
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    sessionTypeId: uuid("session_type_id").references(() => sessionTypes.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    sessionName: text("session_name").notNull(),
    // The client's own name for the shoot, asked on the booking form like
    // PhotoEZ Booking's "Session Title" (e.g. "Tina's Senior Photos"); it
    // becomes the gallery's title.
    title: text("title"),
    priceCents: integer("price_cents").notNull(),
    depositPercent: integer("deposit_percent").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    // pending_payment: held while the client pays the deposit (see holdExpiresAt).
    status: text("status", { enum: BOOKING_STATUSES })
      .notNull()
      .default("confirmed"),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    clientPhone: text("client_phone"),
    notes: text("notes"),
    // Private link for the client to view their booking.
    manageToken: text("manage_token").notNull().unique(),
    rescheduleCount: integer("reschedule_count").notNull().default(0),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by", { enum: ["client", "studio"] }),
    // The client cancelled early enough that their deposit becomes a credit.
    creditDue: boolean("credit_due").notNull().default(false),
    // A pending_payment booking frees its time after this.
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    // When the session and balance reminders went out (cleared on reschedule).
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    balanceReminderSentAt: timestamp("balance_reminder_sent_at", { withTimezone: true }),
    // Total of the extras the client added; the booking total is priceCents + addonsCents.
    addonsCents: integer("addons_cents").notNull().default(0),
    // A coupon's discount off the total, and session credit the client used.
    // What's owed is priceCents + addonsCents - discountCents; credit counts as paid.
    couponCode: text("coupon_code"),
    discountCents: integer("discount_cents").notNull().default(0),
    creditCents: integer("credit_cents").notNull().default(0),
    // A gift card put toward the booking (counts as paid, like credit).
    giftCardId: uuid("gift_card_id"),
    giftCardCents: integer("gift_card_cents").notNull().default(0),
    // A friend's booking through a client's referral link: who shared it,
    // the friend's discount (already part of discountCents), the credit
    // promised to the client who shared, and when it was given.
    referredByClientId: uuid("referred_by_client_id").references(() => clients.id, { onDelete: "set null" }),
    referralDiscountCents: integer("referral_discount_cents").notNull().default(0),
    referralRewardCents: integer("referral_reward_cents").notNull().default(0),
    referralRewardedAt: timestamp("referral_rewarded_at", { withTimezone: true }),
    // The client's answers to the studio's custom booking questions, copied
    // with each question's wording so later edits don't change past bookings.
    answers: jsonb("answers").$type<BookingAnswer[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bookings_photographer_idx").on(t.photographerId, t.startsAt)],
);

// The extras on a booking, with the name and price copied in so later edits
// to the add-on don't change past bookings.
// The studio's own questions on the booking form (like PhotoEZ Booking's
// custom fields). sessionTypeIds empty = asked for every session.
export const bookingFields = pgTable(
  "booking_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    type: text("type", { enum: BOOKING_FIELD_TYPES }).notNull(),
    // Choices for a dropdown.
    options: jsonb("options").$type<string[]>().notNull().default([]),
    required: boolean("required").notNull().default(false),
    sessionTypeIds: jsonb("session_type_ids").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_fields_photographer_idx").on(t.photographerId, t.sortOrder)],
);

// A signed contract: an exact copy of what the client saw, with their
// signature and when/where they signed, kept even if the template changes.
export const signedContracts = pgTable("signed_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => contractTemplates.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  // The contract with every placeholder filled in, as signed.
  content: text("content").notNull(),
  signerName: text("signer_name").notNull(),
  signatureType: text("signature_type", { enum: ["draw", "type"] }).notNull(),
  // A PNG data URL for a drawn signature; the typed name for a typed one.
  signatureData: text("signature_data").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
  clientIp: text("client_ip"),
  userAgent: text("user_agent"),
});

// Payments on a booking through Stripe Checkout, on the photographer's own
// Stripe account: the deposit at booking, then the balance.
// Coupon codes clients enter when booking: % or $ off the whole total.
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // Stored uppercase; clients can type it any way.
    code: text("code").notNull(),
    kind: text("kind", { enum: ["percent", "amount"] }).notNull(),
    // A percentage (1-100) for "percent", cents for "amount".
    value: integer("value").notNull(),
    // Empty = every session.
    sessionTypeIds: jsonb("session_type_ids").$type<string[]>().notNull().default([]),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    // Most bookings that can use it; null = no limit.
    maxUses: integer("max_uses"),
    // Most bookings one client (by email) can use it for; null = no limit.
    maxUsesPerClient: integer("max_uses_per_client"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("coupons_code_unique").on(t.photographerId, t.code)],
);

// Session credits (like PhotoEZ Booking's credits): money a client can put
// toward a future booking, matched by email. Issued when a client cancels
// early enough, returned when a booking that used credit is cancelled, or
// added by the photographer.
export const sessionCredits = pgTable(
  "session_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    clientEmail: text("client_email").notNull(),
    clientName: text("client_name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    usedCents: integer("used_cents").notNull().default(0),
    reason: text("reason").notNull(),
    sourceBookingId: uuid("source_booking_id").references(() => bookings.id, { onDelete: "set null" }),
    // Last day it can be used (studio's calendar); null = never expires.
    expiresOn: date("expires_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("session_credits_client_idx").on(t.photographerId, t.clientEmail)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // A payment is for a booking or for a gallery's extra photos.
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id").references(() => galleries.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["deposit", "balance", "gallery_extras", "gift_card", "store_order"] }).notNull(),
    // For a store order (lib/store/checkout.ts): the order being paid for.
    storeOrderId: uuid("store_order_id"),
    // For a gift card purchase: the card being bought.
    giftCardId: uuid("gift_card_id"),
    // How many extra photos a gallery_extras payment covers.
    quantity: integer("quantity"),
    amountCents: integer("amount_cents").notNull(),
    status: text("status", { enum: ["pending", "paid", "expired"] }).notNull().default("pending"),
    stripeAccountId: text("stripe_account_id").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull().unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_booking_idx").on(t.bookingId)],
);

// Inspiration photos a client uploaded with their booking (storage keys).
export const bookingInspoPhotos = pgTable(
  "booking_inspo_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("booking_inspo_photos_booking_idx").on(t.bookingId)],
);

export const bookingAddons = pgTable(
  "booking_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    addonId: uuid("addon_id").references(() => addons.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    // Extra units bought, beyond any included with the session.
    quantity: integer("quantity").notNull(),
    includedQuantity: integer("included_quantity").notNull().default(0),
  },
  (t) => [index("booking_addons_booking_idx").on(t.bookingId)],
);

// A new-client inquiry (email or contact-form message) and what the AI
// triage pulled out of it. `triage` holds the validated TriageResult.
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // Set once the inquiry is turned into a client.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    status: text("status", { enum: ["new", "replied", "converted", "archived"] })
      .notNull()
      .default("new"),
    // "form" = sent from the public studio page; "directory" = the same form,
    // reached from the photographer directory; "pasted" = added by the photographer.
    source: text("source", { enum: ["pasted", "form", "directory"] }).notNull().default("pasted"),
    fromName: text("from_name"),
    fromEmail: text("from_email"),
    message: text("message").notNull(),
    triage: jsonb("triage").$type<TriageResult>(),
    triageError: text("triage_error"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
    // When the reply was emailed, and whether it went out on its own.
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    autoReplied: boolean("auto_replied").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inquiries_photographer_idx").on(t.photographerId, t.createdAt)],
);

// A photo the client marked as a favorite. Each photo can be favorited once.
export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    // The client's note on this pick, e.g. an editing request. Goes away if
    // they unselect the photo (as in PhotoEZ for WordPress).
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("favorites_photo_unique").on(t.photoId)],
);

// Every email the app sends (or tried to), with the message itself, so the
// photographer can see what went out (PhotoEZ Booking's email log).
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // What it was, e.g. "booking_confirmed" (see lib/email/kinds.ts).
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    // skipped: email sending isn't set up (e.g. on a developer's computer).
    status: text("status", { enum: ["sent", "failed", "skipped"] }).notNull(),
    error: text("error"),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    galleryId: uuid("gallery_id").references(() => galleries.id, { onDelete: "set null" }),
    inquiryId: uuid("inquiry_id").references(() => inquiries.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_log_photographer_idx").on(t.photographerId, t.createdAt)],
);

// A client's review of the studio, from a private link emailed after their
// gallery is delivered. Screened by the photographer before it shows on the
// studio page (requested → submitted → approved or rejected).
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // One review per gallery; kept if the gallery is later deleted.
    galleryId: uuid("gallery_id")
      .unique()
      .references(() => galleries.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    // Random, unguessable token in the review link.
    token: text("token").notNull().unique(),
    status: text("status", { enum: ["requested", "submitted", "approved", "rejected"] })
      .notNull()
      .default("requested"),
    // The name shown with the review, e.g. "Jasmine L."
    displayName: text("display_name"),
    rating: integer("rating"),
    body: text("body"),
    // A photo from their gallery to show with the review, only with their OK.
    photoId: uuid("photo_id").references(() => photos.id, { onDelete: "set null" }),
    photoConsent: boolean("photo_consent").notNull().default(false),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_photographer_idx").on(t.photographerId, t.status)],
);

// "Examples of work" on the studio page: up to 10 portfolio photos, in the
// photographer's order. Stored as ~1600px JPEGs (fileKey).
export const studioPhotos = pgTable(
  "studio_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("studio_photos_photographer_idx").on(t.photographerId, t.position)],
);

// A studio gift card: bought on the studio page (Stripe, on the
// photographer's account) or issued free by the photographer. Its code is
// entered at booking; whatever isn't used stays on the card.
export const giftCards = pgTable(
  "gift_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // e.g. "GIFT-7KQ2-M9XD" (no look-alike letters or digits).
    code: text("code").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    balanceCents: integer("balance_cents").notNull(),
    // pending_payment: waiting on Stripe; void: cancelled by the studio.
    status: text("status", { enum: ["pending_payment", "active", "void"] }).notNull().default("pending_payment"),
    source: text("source", { enum: ["purchased", "issued"] }).notNull().default("purchased"),
    buyerName: text("buyer_name"),
    buyerEmail: text("buyer_email"),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email"),
    message: text("message"),
    // The studio-calendar day to email the recipient (null = right away).
    deliverOn: date("deliver_on"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gift_cards_photographer_idx").on(t.photographerId, t.createdAt)],
);

// Every AI call the app makes for a studio, with its token counts, so costs
// can be tracked and each plan's monthly allowance enforced.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // e.g. "photo_tag", "assistant".
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_photographer_idx").on(t.photographerId, t.feature, t.createdAt)],
);

// Something the Studio Assistant prepared for the photographer to approve
// (an email, reminders, booking changes). Nothing happens until they click
// Approve; the payload is re-checked then (lib/ai/assistant/proposals.ts).
export const assistantProposals = pgTable(
  "assistant_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["client_email", "gallery_emails", "balance_reminders", "booking_status"] }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    // What the card says, e.g. "Email 3 clients: Your gallery closes Friday".
    summary: text("summary").notNull(),
    status: text("status", { enum: ["pending", "done", "dismissed"] }).notNull().default("pending"),
    // What happened when it was approved, e.g. "Sent 3 of 3".
    result: text("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [index("assistant_proposals_photographer_idx").on(t.photographerId, t.createdAt)],
);

// A Studio Assistant conversation, kept so the photographer can look back
// at earlier answers (e.g. camera settings) or pick up where they left off.
// Only the 10 most recent are kept, for up to 90 days (lib/ai/assistant/history.ts).
export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // The first question, shortened, for the Recent list.
    title: text("title").notNull(),
    // Questions and answers in order; an answer lists the approval cards it made.
    turns: jsonb("turns")
      .$type<{ role: "user" | "assistant"; text: string; proposalIds?: string[] }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_conversations_photographer_idx").on(t.photographerId, t.updatedAt)],
);

// A photographer referral that paid off: once the referred studio's first
// plan payment goes through, the referrer gets a month of credit on their
// PhotoEZ Cloud bill (lib/referrals.ts). One row per referred studio.
export const referralRewards = pgTable(
  "referral_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    referredId: uuid("referred_id")
      .notNull()
      .unique()
      .references(() => photographers.id, { onDelete: "cascade" }),
    // "credited" = added to the referrer's Stripe balance; "capped" = past
    // the yearly limit, so no credit.
    status: text("status", { enum: ["credited", "capped"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("referral_rewards_referrer_idx").on(t.referrerId, t.createdAt)],
);

// ---- Online Store (lib/store) ----

// One size or option of a store product, e.g. "8×10" at $25. For prints,
// widthIn × heightIn is the shape the client crops their photo to.
export type StoreVariant = {
  id: string;
  label: string;
  priceCents: number;
  widthIn: number | null;
  heightIn: number | null;
  // SwaggPress products: the partner's variant and its wholesale price, and
  // whether SwaggPress still offers it (lib/swaggpress/catalog.ts).
  labVariantId?: number | null;
  wholesaleCents?: number | null;
  available?: boolean;
  // SwaggPress products: this color's product picture and swatch color.
  labImage?: string | null;
  colorHex?: string | null;
};

// A SwaggPress product's options besides size and color (e.g. Trim: Without
// trim / With trim +$5), as its partner catalog sends them. The price change
// passes through to the client at the same amount.
export type StoreLabOption = {
  name: string;
  required: boolean;
  choices: { label: string; modCents: number }[];
  // Shown only when an earlier option has this choice (e.g. Trim Type only
  // when Trim is "With trim").
  showIf?: { option: string; choice: string } | null;
};

// A field a SwaggPress "Custom Text & Photos" product asks for: a line of
// text, a dropdown, or photos (chosen from the client's gallery).
export type StoreLabField = {
  key: string;
  label: string;
  placeholder: string;
  // Characters for text; how many photos for image fields.
  max: number;
  required: boolean;
  type: "text" | "select" | "image";
  // Photo fields: "upload" (the client's own file, e.g. a school logo) or
  // "gallery" (a photo from their gallery, or an upload).
  source?: "upload" | "gallery";
  choices: string[];
  // Shown only when an option (or an earlier dropdown field) has this choice.
  showIf?: { option: string; choice: string } | null;
};

// A SwaggPress product's design setup, as its partner catalog sends it.
export type StoreLabArea = { x: number; y: number; w: number; h: number };
export type StoreLabDesign = {
  canvas: { w: number; h: number };
  front: { mockup: string | null; area: StoreLabArea };
  back: { mockup: string | null; area: StoreLabArea } | null;
  fullWrap: boolean;
  printPx: { w: number; h: number; dpi: number } | null;
  // The client picks panels or a full wrap; wrap costs wrapUpchargeCents more.
  wrapChoice?: boolean;
  wrapUpchargeCents?: number;
  // The whole wrap laid flat, in inches (null = not set in SwaggPress).
  wrapInches?: { w: number; h: number } | null;
  // All-over printing (tees): the whole shirt, edge to edge, for an upcharge;
  // inches = the print size per side (null = not set in SwaggPress).
  allOver?: { upchargeCents: number; inches: { w: number; h: number } | null } | null;
  // "View in 3D" model in the designer ("tee"); round products always get one.
  view3d?: "tee" | null;
  // Two-sided products: what a back design costs (charged only when used).
  backUpchargeCents?: number;
};

// Something clients can order with one of their photos: a print, canvas,
// mug, tee… "self" = the studio makes and ships it; lab partners like
// SwaggPress come later.
export const storeProducts = pgTable(
  "store_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // The client crops their photo to the chosen size's shape (prints, canvas).
    cropToSize: boolean("crop_to_size").notNull().default(true),
    variants: jsonb("variants").$type<StoreVariant[]>().notNull().default([]),
    // Pictures of the product itself (a sample canvas, the tee), in order;
    // storage keys (lib/storage.ts storeProductPhotoKey), up to 6.
    imageKeys: jsonb("image_keys").$type<string[]>().notNull().default([]),
    fulfillment: text("fulfillment", { enum: ["self", "swaggpress"] }).notNull().default("self"),
    // SwaggPress products: which catalog product, its photos (their URLs),
    // and whether SwaggPress stopped offering it.
    labProductId: integer("lab_product_id"),
    labImageUrls: jsonb("lab_image_urls").$type<string[]>().notNull().default([]),
    labUnavailable: boolean("lab_unavailable").notNull().default(false),
    // SwaggPress products: how it's designed (mockups, print areas, wrap),
    // for the gallery designer. Null = no designer, just the photo.
    labDesign: jsonb("lab_design").$type<StoreLabDesign>(),
    labOptions: jsonb("lab_options").$type<StoreLabOption[]>().notNull().default([]),
    // How clients order it, as set on SwaggPress: "custom_design" (the
    // designer), "custom_text" (fill in labFields) or "standard". Null =
    // not synced yet (treated as before: the designer when there's a design).
    labMode: text("lab_mode", { enum: ["custom_design", "custom_text", "standard"] }),
    labFields: jsonb("lab_fields").$type<StoreLabField[]>().notNull().default([]),
    // Shown only in galleries for these session types; empty = every gallery.
    sessionTypeIds: jsonb("session_type_ids").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("store_products_photographer_idx").on(t.photographerId, t.sortOrder)],
);

export const STORE_ORDER_STATUSES = ["pending_payment", "paid", "shipped", "cancelled"] as const;

// A client's order from a gallery, paid through the studio's Stripe.
export const storeOrders = pgTable(
  "store_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id").references(() => galleries.id, { onDelete: "set null" }),
    // Short number shown to clients and in emails, e.g. "PEZ-4K7Q2M".
    orderNumber: text("order_number").notNull().unique(),
    status: text("status", { enum: STORE_ORDER_STATUSES }).notNull().default("pending_payment"),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    // Filled from Stripe Checkout once paid.
    shipName: text("ship_name"),
    shipLine1: text("ship_line1"),
    shipLine2: text("ship_line2"),
    shipCity: text("ship_city"),
    shipState: text("ship_state"),
    shipPostalCode: text("ship_postal_code"),
    shipCountry: text("ship_country"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    handlingCents: integer("handling_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    // The studio's own items: how they were shipped (carrier/tracking/shippedAt).
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    // SwaggPress items (lib/swaggpress/orders.ts): the shipping the client
    // chose, and the partner order's progress once sent.
    labShippingCents: integer("lab_shipping_cents").notNull().default(0),
    labShippingService: text("lab_shipping_service"),
    labRateId: text("lab_rate_id"),
    labStatus: text("lab_status", { enum: ["none", "pending", "sent", "failed", "shipped"] }).notNull().default("none"),
    labOrderNumber: text("lab_order_number"),
    labError: text("lab_error"),
    labCarrier: text("lab_carrier"),
    labTracking: text("lab_tracking"),
    labSubmittedAt: timestamp("lab_submitted_at", { withTimezone: true }),
    labShippedAt: timestamp("lab_shipped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("store_orders_photographer_idx").on(t.photographerId, t.createdAt)],
);

// Where on the photo the client cropped: fractions (0–1) of its width and height.
export type StoreCrop = { x: number; y: number; width: number; height: number };

export const storeOrderItems = pgTable(
  "store_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => storeOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => storeProducts.id, { onDelete: "set null" }),
    photoId: uuid("photo_id").references(() => photos.id, { onDelete: "set null" }),
    // Copies, so later product edits never change an order.
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    unitCents: integer("unit_cents").notNull(),
    quantity: integer("quantity").notNull(),
    crop: jsonb("crop").$type<StoreCrop>(),
    photoName: text("photo_name"),
    fulfillment: text("fulfillment", { enum: ["self", "swaggpress"] }).notNull().default("self"),
    // SwaggPress items: which partner variant to send.
    labVariantId: integer("lab_variant_id"),
    labProductId: integer("lab_product_id"),
    // The options the client picked, e.g. { Trim: "With trim" }.
    options: jsonb("options").$type<Record<string, string>>(),
    // Custom Text & Photos products: the answers by field label, and the
    // photos for photo fields: gallery photo ids, and "upload:<file>" entries
    // for files the client uploaded (lib/store/field-uploads.ts).
    fields: jsonb("fields").$type<Record<string, string>>(),
    fieldPhotoIds: jsonb("field_photo_ids").$type<string[]>(),
    // Designed in the gallery designer: its print files replace the photo.
    designId: uuid("design_id").references(() => storeDesigns.id, { onDelete: "set null" }),
  },
  (t) => [index("store_order_items_order_idx").on(t.orderId)],
);

// A design a client made in the gallery designer (swagg-designer): the
// editable design, a picture of it on the product, and print-ready files.
// Made when they add it to the cart; ones never ordered are removed after
// 30 days (lib/store/designs.ts).
export const storeDesigns = pgTable(
  "store_designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photographerId: uuid("photographer_id")
      .notNull()
      .references(() => photographers.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => storeProducts.id, { onDelete: "set null" }),
    design: jsonb("design").$type<Record<string, unknown>>().notNull(),
    previewKey: text("preview_key").notNull(),
    frontKey: text("front_key").notNull(),
    backKey: text("back_key"),
    photoIds: jsonb("photo_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("store_designs_gallery_idx").on(t.galleryId, t.createdAt)],
);

// Shipping options quoted in a gallery cart for SwaggPress items (live
// Shippo rates via SwaggPress), kept so checkout charges exactly what was
// shown. Expire after a day.
export type StoreShipTo = { name: string; line1: string; line2: string; city: string; state: string; zip: string; phone: string };
export type StoreQuotedRate = { id: string; carrier: string; service: string; amountCents: number; days: number | null };

export const storeShippingQuotes = pgTable("store_shipping_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  galleryId: uuid("gallery_id")
    .notNull()
    .references(() => galleries.id, { onDelete: "cascade" }),
  shipTo: jsonb("ship_to").$type<StoreShipTo>().notNull(),
  rates: jsonb("rates").$type<StoreQuotedRate[]>().notNull(),
  // The SwaggPress lines quoted (variant:qty…), so a changed cart needs a new quote.
  itemsKey: text("items_key").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Email addresses collected on the campaign landing page (/join) before the
// person has an account. Kept even if they never finish signing up, so there's
// a list to follow up with. `source` is the ?src= of the link they came from.
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Lowercased, so the same address is never saved twice.
  email: text("email").notNull().unique(),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
