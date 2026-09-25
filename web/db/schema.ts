import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  jsonb,
  unique,
  date,
} from "drizzle-orm/pg-core";
import type { TriageResult } from "../lib/ai/triage";
import { BOOKING_FIELD_TYPES, type BookingAnswer } from "../lib/booking/fields";
import { BOOKING_STATUSES } from "../lib/booking/status";
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
    title: text("title").notNull(),
    // Random, unguessable token used in the client's gallery link.
    shareToken: text("share_token").notNull().unique(),
    // Same stages as PhotoEZ for WordPress (see lib/gallery-status.ts).
    status: text("status", { enum: GALLERY_STATUSES }).notNull().default("pending"),
    // How many photos the client may pick for free (the "0/10 Selected" counter).
    freeLimit: integer("free_limit").notNull().default(10),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Large photo across the top of the client's gallery page (a storage key).
    headerImageKey: text("header_image_key"),
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
    // Total of the extras the client added; the booking total is priceCents + addonsCents.
    addonsCents: integer("addons_cents").notNull().default(0),
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
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["deposit", "balance"] }).notNull(),
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
    // "form" = sent from the public studio page; "pasted" = added by the photographer.
    source: text("source", { enum: ["pasted", "form"] }).notNull().default("pasted"),
    fromName: text("from_name"),
    fromEmail: text("from_email"),
    message: text("message").notNull(),
    triage: jsonb("triage").$type<TriageResult>(),
    triageError: text("triage_error"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("favorites_photo_unique").on(t.photoId)],
);
