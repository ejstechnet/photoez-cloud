import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("galleries_photographer_idx").on(t.photographerId),
    index("galleries_client_idx").on(t.clientId),
  ],
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
