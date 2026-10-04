import { and, asc, count, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  addons,
  bookingAddons,
  bookingInspoPhotos,
  bookings,
  clients,
  contractTemplates,
  favorites,
  galleries,
  invoices,
  migrationKeys,
  payments,
  photographers,
  photos,
  reviews,
  sessionCredits,
  sessionTypeAddons,
  sessionTypes,
  signedContracts,
} from "@/db/schema";
import { bookingTotal } from "@/lib/payments/amounts";
import { LOCATION_LABELS, type ShootLocation } from "@/lib/session-types";
import { photoKey, signedViewUrl } from "@/lib/storage";
import {
  MIGRATION_FORMAT,
  MIGRATION_VERSION,
  hashMigrationKey,
  isGalleryStatus,
  keyFromHeader,
  toPage,
  type MAddon,
  type MBooking,
  type MClient,
  type MContract,
  type MCredit,
  type MGallery,
  type MInvoice,
  type MReview,
  type MSessionType,
  type Manifest,
} from "./format";

// PhotoEZ Cloud as a migration *source* (docs/migration-format.md): the
// read-only data a studio's migration key opens up, for the PhotoEZ
// Migration plugin on WordPress to pull. Everything is scoped to the key's studio.

// The studio a request's key belongs to, or null (missing, wrong, expired, or revoked).
export async function studioForRequest(request: Request): Promise<string | null> {
  const key = keyFromHeader(request.headers.get("authorization"));
  if (!key) return null;
  const [row] = await db
    .select({ id: migrationKeys.id, photographerId: migrationKeys.photographerId, lastUsedAt: migrationKeys.lastUsedAt })
    .from(migrationKeys)
    .where(and(eq(migrationKeys.keyHash, hashMigrationKey(key)), isNull(migrationKeys.revokedAt), gt(migrationKeys.expiresAt, new Date())));
  if (!row) return null;
  // Noted at most once a minute, for "last used" in Settings.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(migrationKeys).set({ lastUsedAt: new Date() }).where(eq(migrationKeys.id, row.id));
  }
  return row.photographerId;
}

export async function manifest(photographerId: string): Promise<Manifest> {
  const [[studio], [c], [g], [p], [st], [ad], [ct], [bk], [cr], [rv], [iv]] = await Promise.all([
    db
      .select({ name: photographers.name, businessName: photographers.businessName, email: photographers.email, timeZone: photographers.timeZone })
      .from(photographers)
      .where(eq(photographers.id, photographerId)),
    db.select({ n: count() }).from(clients).where(eq(clients.photographerId, photographerId)),
    db.select({ n: count() }).from(galleries).where(eq(galleries.photographerId, photographerId)),
    db.select({ n: count() }).from(photos).innerJoin(galleries, eq(galleries.id, photos.galleryId)).where(eq(galleries.photographerId, photographerId)),
    db.select({ n: count() }).from(sessionTypes).where(eq(sessionTypes.photographerId, photographerId)),
    db.select({ n: count() }).from(addons).where(eq(addons.photographerId, photographerId)),
    db.select({ n: count() }).from(contractTemplates).where(eq(contractTemplates.photographerId, photographerId)),
    db.select({ n: count() }).from(bookings).where(movableBookings(photographerId)),
    db.select({ n: count() }).from(sessionCredits).where(eq(sessionCredits.photographerId, photographerId)),
    db.select({ n: count() }).from(reviews).where(eq(reviews.photographerId, photographerId)),
    db.select({ n: count() }).from(invoices).where(eq(invoices.photographerId, photographerId)),
  ]);
  return {
    format: MIGRATION_FORMAT,
    version: MIGRATION_VERSION,
    source: "cloud",
    studio: { name: studio.businessName || studio.name, email: studio.email, timeZone: studio.timeZone },
    counts: {
      clients: c.n,
      galleries: g.n,
      photos: p.n,
      sessionTypes: st.n,
      addons: ad.n,
      contracts: ct.n,
      bookings: bk.n,
      credits: cr.n,
      reviews: rv.n,
      invoices: iv.n,
    },
  };
}

// Bookings worth moving: everything but deposit holds that were never paid.
function movableBookings(photographerId: string) {
  return and(eq(bookings.photographerId, photographerId), ne(bookings.status, "pending_payment"));
}

export async function clientPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, notes: clients.notes })
    .from(clients)
    .where(eq(clients.photographerId, photographerId))
    .orderBy(asc(clients.createdAt), asc(clients.id))
    .offset(offset)
    .limit(limit + 1);
  return toPage<MClient>(rows, offset, limit);
}

export async function addonPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select({ id: addons.id, name: addons.name, description: addons.description, priceCents: addons.priceCents, maxQuantity: addons.maxQuantity })
    .from(addons)
    .where(eq(addons.photographerId, photographerId))
    .orderBy(asc(addons.sortOrder), asc(addons.createdAt), asc(addons.id))
    .offset(offset)
    .limit(limit + 1);
  return toPage<MAddon>(rows, offset, limit);
}

export async function sessionTypePage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(sessionTypes)
    .where(eq(sessionTypes.photographerId, photographerId))
    .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt), asc(sessionTypes.id))
    .offset(offset)
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const links = page.length
    ? await db
        .select({ sessionTypeId: sessionTypeAddons.sessionTypeId, addonId: sessionTypeAddons.addonId, includedQuantity: sessionTypeAddons.includedQuantity })
        .from(sessionTypeAddons)
        .where(inArray(sessionTypeAddons.sessionTypeId, page.map((s) => s.id)))
    : [];
  const items: MSessionType[] = await Promise.all(
    page.map(async (s) => ({
      id: s.id,
      name: s.name,
      shortDescription: s.shortDescription,
      descriptionHtml: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      depositPercent: s.depositPercent,
      location: s.location ? (LOCATION_LABELS[s.location as ShootLocation] ?? s.location) : null,
      photosIncluded: s.photosIncluded,
      hidden: s.hidden,
      sortOrder: s.sortOrder,
      imageUrl: s.imageKey ? await signedViewUrl(s.imageKey) : null,
      addons: links.filter((l) => l.sessionTypeId === s.id).map((l) => ({ addonId: l.addonId, includedQuantity: l.includedQuantity })),
    })),
  );
  return { items, next: rows.length > limit ? offset + limit : null };
}

export async function contractPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select({ id: contractTemplates.id, title: contractTemplates.title, contentHtml: contractTemplates.content, isDefault: contractTemplates.isDefault })
    .from(contractTemplates)
    .where(eq(contractTemplates.photographerId, photographerId))
    .orderBy(asc(contractTemplates.createdAt), asc(contractTemplates.id))
    .offset(offset)
    .limit(limit + 1);
  return toPage<MContract>(rows, offset, limit);
}

export async function galleryPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(galleries)
    .where(eq(galleries.photographerId, photographerId))
    .orderBy(asc(galleries.createdAt), asc(galleries.id))
    .offset(offset)
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const photoRows = page.length
    ? await db
        .select({
          id: photos.id,
          galleryId: photos.galleryId,
          kind: photos.kind,
          name: photos.originalName,
          contentType: photos.contentType,
          width: photos.width,
          height: photos.height,
          sizeBytes: photos.sizeBytes,
          position: photos.position,
          favoriteId: favorites.id,
          note: favorites.note,
        })
        .from(photos)
        .leftJoin(favorites, eq(favorites.photoId, photos.id))
        .where(inArray(photos.galleryId, page.map((g) => g.id)))
        .orderBy(asc(photos.kind), asc(photos.position), asc(photos.createdAt))
    : [];
  const items: MGallery[] = page.map((g) => ({
    id: g.id,
    title: g.title,
    clientId: g.clientId,
    status: isGalleryStatus(g.status) ? g.status : "pending",
    freeLimit: g.freeLimit,
    extraPhotoPriceCents: g.extraPhotoPriceCents,
    notesEnabled: g.notesEnabled,
    createdAt: g.createdAt.toISOString(),
    deliveredAt: g.deliveredAt?.toISOString() ?? null,
    expiresAt: g.expiresAt?.toISOString() ?? null,
    coverPhotoId: null,
    photos: photoRows
      .filter((p) => p.galleryId === g.id)
      .map((p) => ({
        id: p.id,
        kind: p.kind === "final" ? "final" : "proof",
        name: p.name,
        contentType: p.contentType,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        position: p.position,
        selected: p.favoriteId !== null,
        note: p.note,
      })),
  }));
  return { items, next: rows.length > limit ? offset + limit : null };
}

// A link to download one photo's original, if it belongs to the key's studio.
export async function originalUrl(photographerId: string, photoId: string) {
  const [row] = await db
    .select({ fileKey: photos.fileKey })
    .from(photos)
    .innerJoin(galleries, eq(galleries.id, photos.galleryId))
    .where(and(eq(photos.id, photoId), eq(galleries.photographerId, photographerId)));
  return row ? signedViewUrl(photoKey(row.fileKey, "original")) : null;
}

// ---- Version 2 ----

export async function bookingPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(bookings)
    .where(movableBookings(photographerId))
    .orderBy(asc(bookings.createdAt), asc(bookings.id))
    .offset(offset)
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const ids = page.map((b) => b.id);
  const [extras, paid, signed, inspo, linked] = ids.length
    ? await Promise.all([
        db.select().from(bookingAddons).where(inArray(bookingAddons.bookingId, ids)),
        db
          .select({ bookingId: payments.bookingId, amountCents: payments.amountCents })
          .from(payments)
          .where(and(inArray(payments.bookingId, ids), eq(payments.status, "paid"))),
        db.select().from(signedContracts).where(inArray(signedContracts.bookingId, ids)),
        db.select().from(bookingInspoPhotos).where(inArray(bookingInspoPhotos.bookingId, ids)).orderBy(asc(bookingInspoPhotos.position)),
        db.select({ id: galleries.id, bookingId: galleries.bookingId }).from(galleries).where(inArray(galleries.bookingId, ids)),
      ])
    : [[], [], [], [], []];
  const items: MBooking[] = page.map((b) => {
    const contract = signed.find((s) => s.bookingId === b.id);
    return {
      id: b.id,
      clientId: b.clientId,
      clientName: b.clientName,
      clientEmail: b.clientEmail,
      clientPhone: b.clientPhone,
      sessionTypeId: b.sessionTypeId,
      sessionName: b.sessionName,
      title: b.title,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      status: b.status === "cancelled" ? "cancelled" : b.status === "completed" || b.startsAt < new Date() ? "completed" : "confirmed",
      totalCents: bookingTotal(b),
      addonsCents: b.addonsCents,
      depositPercent: b.depositPercent,
      paidCents: paid.filter((p) => p.bookingId === b.id).reduce((sum, p) => sum + p.amountCents, 0),
      creditCents: b.creditCents + b.giftCardCents,
      addons: extras
        .filter((a) => a.bookingId === b.id)
        .map((a) => ({ addonId: a.addonId, name: a.name, priceCents: a.priceCents, quantity: a.quantity, includedQuantity: a.includedQuantity })),
      answers: (b.answers ?? []).map((a) => ({ label: a.label, value: a.value })),
      notes: b.notes,
      galleryId: linked.find((g) => g.bookingId === b.id)?.id ?? null,
      createdAt: b.createdAt.toISOString(),
      cancelledAt: b.cancelledAt?.toISOString() ?? null,
      signedContract: contract
        ? {
            title: contract.title,
            contentHtml: contract.content,
            signerName: contract.signerName,
            signatureType: contract.signatureType,
            signatureData: contract.signatureData,
            signedAt: contract.signedAt.toISOString(),
            clientIp: contract.clientIp,
          }
        : null,
      inspoPhotos: inspo
        .filter((i) => i.bookingId === b.id)
        .map((i, n) => ({ id: `inspo-${i.id}`, name: `inspiration-${n + 1}.jpg`, contentType: "image/jpeg" })),
    };
  });
  return { items, next: rows.length > limit ? offset + limit : null };
}

export async function creditPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(sessionCredits)
    .where(eq(sessionCredits.photographerId, photographerId))
    .orderBy(asc(sessionCredits.createdAt), asc(sessionCredits.id))
    .offset(offset)
    .limit(limit + 1);
  const items: MCredit[] = rows.map((c) => ({
    id: c.id,
    clientEmail: c.clientEmail,
    clientName: c.clientName,
    amountCents: c.amountCents,
    usedCents: c.usedCents,
    reason: c.reason,
    sourceBookingId: c.sourceBookingId,
    expiresOn: c.expiresOn,
    createdAt: c.createdAt.toISOString(),
  }));
  return toPage(items, offset, limit);
}

export async function reviewPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.photographerId, photographerId))
    .orderBy(asc(reviews.createdAt), asc(reviews.id))
    .offset(offset)
    .limit(limit + 1);
  const items: MReview[] = rows.map((r) => ({
    id: r.id,
    galleryId: r.galleryId,
    clientName: r.clientName,
    clientEmail: r.clientEmail,
    status: r.status,
    displayName: r.displayName,
    rating: r.rating,
    body: r.body,
    photoId: r.photoId,
    photoConsent: r.photoConsent,
    requestedAt: r.requestedAt.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
  }));
  return toPage(items, offset, limit);
}

export async function invoicePage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.photographerId, photographerId))
    .orderBy(asc(invoices.createdAt), asc(invoices.id))
    .offset(offset)
    .limit(limit + 1);
  const items: MInvoice[] = rows.map((i) => ({
    id: i.id,
    kind: i.kind,
    number: i.number,
    status: i.status,
    clientId: i.clientId,
    clientName: i.clientName,
    clientEmail: i.clientEmail,
    clientPhone: i.clientPhone,
    title: i.title,
    eventDate: i.eventDate,
    dueDate: i.dueDate,
    items: i.items.map((li) => ({ description: li.description, quantity: li.quantity, unitCents: li.unitCents })),
    taxBps: i.taxBps,
    subtotalCents: i.subtotalCents,
    taxCents: i.taxCents,
    totalCents: i.totalCents,
    depositPercent: i.plan.mode === "full" ? 0 : i.plan.depositPercent,
    paidCents: i.paidCents,
    notes: i.notes,
    terms: i.terms,
    createdAt: i.createdAt.toISOString(),
    approvedAt: i.approvedAt?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    signedContract:
      i.signedAt && i.signatureType && i.signatureData && i.contractContent
        ? {
            title: i.contractTitle,
            contentHtml: i.contractContent,
            signerName: i.signerName ?? i.clientName,
            signatureType: i.signatureType,
            signatureData: i.signatureData,
            signedAt: i.signedAt.toISOString(),
            clientIp: i.signerIp,
          }
        : null,
  }));
  return toPage(items, offset, limit);
}

// A link to one booking inspiration photo, if it belongs to the key's studio.
export async function inspoUrl(photographerId: string, inspoId: string) {
  const [row] = await db
    .select({ fileKey: bookingInspoPhotos.fileKey })
    .from(bookingInspoPhotos)
    .innerJoin(bookings, eq(bookings.id, bookingInspoPhotos.bookingId))
    .where(and(eq(bookingInspoPhotos.id, inspoId), eq(bookings.photographerId, photographerId)));
  return row ? signedViewUrl(row.fileKey) : null;
}
