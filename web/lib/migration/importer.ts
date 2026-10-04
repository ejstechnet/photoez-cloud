import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull, max, sql } from "drizzle-orm";
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
  migrationImports,
  migrationMap,
  payments,
  photographers,
  photos,
  reviews,
  sessionCredits,
  sessionTypeAddons,
  sessionTypes,
  signedContracts,
} from "@/db/schema";
import { localDateOf } from "@/lib/booking/time";
import { buildSchedule, finalDueDate, nextScheduled, statusAfterPayment, type PaymentPlan } from "@/lib/invoices/math";
import { newInvoiceToken, nextNumber } from "@/lib/invoices/server";
import { galleryLimitError, storageLimitError } from "@/lib/plan-usage";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/photo-limits";
import { sanitizeRichText } from "@/lib/rich-text";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { inspoKey, photoKey, photoPrefix, putObject, readObject, sessionImageKey } from "@/lib/storage";
import {
  MIGRATION_FORMAT,
  chosenTotals,
  type ImportChoice,
  type MAddon,
  type MBooking,
  type MClient,
  type MContract,
  type MCredit,
  type MGallery,
  type MInvoice,
  type MReview,
  type MSessionType,
  type MSignature,
  type Manifest,
  type Page,
} from "./format";
import { makeVariants, type Watermark } from "./variants";
import sharp from "sharp";

// Imports a studio from PhotoEZ for WordPress (the PhotoEZ Migration plugin's
// read-only API, docs/migration-format.md), a little at a time: each step runs
// for up to ~20 seconds and saves where it got to, and the Settings page keeps
// calling the next step with a progress bar. Order: clients → add-ons →
// session types → contracts → galleries (each gallery's photos right after it)
// → bookings (signed contracts, inspiration photos) → credits → reviews →
// quotes/invoices.
// Anything already here with the same email or name is reused, not duplicated.

const STEP_MS = 20_000;
const PHASES = ["clients", "addons", "session_types", "contracts", "galleries", "bookings", "credits", "reviews", "invoices", "done"] as const;
type Phase = (typeof PHASES)[number];
const MAX_ERRORS = 200;

export type ImportJob = typeof migrationImports.$inferSelect;

// ---- Talking to the WordPress site ----

class Remote {
  constructor(
    private base: string,
    private key: string,
  ) {}

  private headers() {
    // Some hosts strip Authorization before WordPress sees it; the plugin also accepts X-PhotoEZ-Key.
    return { Authorization: `Bearer ${this.key}`, "X-PhotoEZ-Key": this.key, Accept: "application/json" };
  }

  async get<T>(path: string, query: Record<string, number> = {}): Promise<T> {
    const url = new URL(`${this.base}/${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    let response: Response;
    try {
      response = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(30_000), cache: "no-store" });
    } catch {
      throw new ImportError("Couldn't reach your WordPress site. Check the address, and that the site is online.");
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : null;
      throw new ImportError(message ?? `Your WordPress site answered ${response.status}.`);
    }
    if (!body || typeof body !== "object") throw new ImportError("Your WordPress site didn't send PhotoEZ migration data. Is the PhotoEZ Migration plugin active?");
    return body as T;
  }

  async original(photoId: string) {
    const response = await fetch(`${this.base}/photos/${encodeURIComponent(photoId)}/original`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`the photo couldn't be downloaded (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
}

// A problem that pauses the import (shown to the studio), as opposed to one
// record that can't be imported (listed at the end).
class ImportError extends Error {}

// What the studio typed (a site address) → the plugin's API base.
export function apiBase(address: string) {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(address.trim()) ? address.trim() : `https://${address.trim()}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const path = url.pathname.replace(/\/+$/, "");
  if (path.includes("/wp-json/photoez-migration/v1")) return `${url.origin}${path}`;
  return `${url.origin}${path}/wp-json/photoez-migration/v1`;
}

// ---- Starting and stepping ----

export async function currentImport(photographerId: string) {
  const [job] = await db.select().from(migrationImports).where(eq(migrationImports.photographerId, photographerId));
  return job ?? null;
}

export type SourceGallery = { id: string; title: string; status: string; clientId: string | null; clientName: string | null; photos: number };
export type SourcePreview = { studioName: string | null; counts: Manifest["counts"]; galleries: SourceGallery[] };

type Connected = { base: string; remote: Remote; manifest: Manifest };

async function connect(address: string, key: string): Promise<Connected | { error: string }> {
  const base = apiBase(address);
  if (!base) return { error: "Enter your WordPress site's address, like https://mystudio.com." };
  if (!/^pezm_[A-Za-z0-9_-]{20,80}$/.test(key.trim())) return { error: "That doesn't look like a migration key. It starts with pezm_." };
  const remote = new Remote(base, key.trim());
  let manifest: Manifest;
  try {
    manifest = await remote.get<Manifest>("manifest");
  } catch (error) {
    return { error: error instanceof ImportError ? error.message : "Couldn't connect to your WordPress site." };
  }
  if (manifest.format !== MIGRATION_FORMAT || !(manifest.version >= 1)) return { error: "That site isn't sending PhotoEZ migration data." };
  return { base, remote, manifest };
}

// "Connect": what the WordPress site has, so the studio can choose what to bring.
export async function previewSource(address: string, key: string): Promise<SourcePreview | { error: string }> {
  const c = await connect(address, key);
  if ("error" in c) return { error: c.error };
  try {
    const names = new Map<string, string>();
    for (let offset: number | null = 0; offset !== null; ) {
      const page: Page<MClient> = await c.remote.get<Page<MClient>>("clients", { offset, limit: 100 });
      for (const client of page.items ?? []) names.set(client.id, client.name || client.email || "");
      offset = page.next ?? null;
    }
    const galleries: SourceGallery[] = [];
    for (let offset: number | null = 0; offset !== null; ) {
      const page: Page<MGallery> = await c.remote.get<Page<MGallery>>("galleries", { offset, limit: 20 });
      for (const g of page.items ?? []) {
        galleries.push({
          id: g.id,
          title: g.title,
          status: g.status,
          clientId: g.clientId,
          clientName: g.clientId ? (names.get(g.clientId) ?? null) : null,
          photos: g.photos.length,
        });
      }
      offset = page.next ?? null;
    }
    return { studioName: c.manifest.studio?.name ?? null, counts: c.manifest.counts, galleries };
  } catch (error) {
    return { error: error instanceof ImportError ? error.message : "Couldn't read your WordPress site's galleries." };
  }
}

export async function startImport(
  photographerId: string,
  address: string,
  key: string,
  hideSessions: boolean,
  // What to bring (null = everything), and the galleries' photo counts for the progress bar.
  include: ImportChoice | null = null,
  galleries: { id: string; photos: number }[] = [],
): Promise<ImportJob | { error: string }> {
  const c = await connect(address, key);
  if ("error" in c) return { error: c.error };
  const { base, manifest } = c;
  const values = {
    photographerId,
    sourceBase: base,
    keySealed: sealSecret(key.trim()),
    studioName: manifest.studio?.name ?? null,
    phase: "clients",
    offset: 0,
    hideSessions,
    include,
    totals: include ? chosenTotals(manifest.counts, include, galleries) : { ...manifest.counts },
    done: { clients: 0, addons: 0, sessionTypes: 0, contracts: 0, galleries: 0, photos: 0, bookings: 0, credits: 0, reviews: 0, invoices: 0 },
    errors: [],
    startedAt: new Date(),
    finishedAt: null,
    updatedAt: new Date(),
  };
  const [job] = await db
    .insert(migrationImports)
    .values(values)
    .onConflictDoUpdate({ target: migrationImports.photographerId, set: values })
    .returning();
  return job;
}

export async function clearImport(photographerId: string) {
  await db.delete(migrationImports).where(eq(migrationImports.photographerId, photographerId));
}

// Runs for up to STEP_MS and returns the job; { error } pauses it.
export async function runStep(photographerId: string): Promise<{ job: ImportJob; error?: string } | { error: string }> {
  const job = await currentImport(photographerId);
  if (!job) return { error: "There's no import running." };
  if (job.phase === "done") return { job };
  const key = openSecret(job.keySealed);
  if (!key) return { error: "The migration key couldn't be read. Start a new import." };
  const state = new Step(job, new Remote(job.sourceBase, key));
  let error: string | undefined;
  try {
    const deadline = Date.now() + STEP_MS;
    while (state.phase !== "done" && Date.now() < deadline) await state.runPhase(deadline);
  } catch (e) {
    if (!(e instanceof ImportError)) console.error("Migration step failed", e);
    error = e instanceof ImportError ? e.message : "Something went wrong on our side. Try Continue in a minute.";
  }
  const [saved] = await db
    .update(migrationImports)
    .set({
      phase: state.phase,
      offset: state.offset,
      done: state.done,
      errors: state.errors,
      finishedAt: state.phase === "done" ? (job.finishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(migrationImports.id, job.id))
    .returning();
  return { job: saved, error };
}

// ---- One step's work ----

class Step {
  phase: Phase;
  offset: number;
  done: Record<string, number>;
  errors: { what: string; why: string }[];
  private photographerId: string;
  private source: string;
  private hideSessions: boolean;
  private include: ImportChoice | null;
  private watermark: Watermark | null | undefined;

  constructor(
    job: ImportJob,
    private remote: Remote,
  ) {
    this.phase = (PHASES as readonly string[]).includes(job.phase) ? (job.phase as Phase) : "clients";
    this.offset = job.offset;
    this.done = { ...job.done };
    this.errors = [...job.errors];
    this.photographerId = job.photographerId;
    this.source = job.sourceBase;
    this.hideSessions = job.hideSessions;
    this.include = job.include ?? null;
  }

  private count(kind: string) {
    this.done[kind] = (this.done[kind] ?? 0) + 1;
  }

  // Done, but not copied: it was brought over before, or this studio already
  // has it (same email or name). Shown as "already here" next to the count.
  private alreadyHere(kind: string, n = 1) {
    this.done[kind] = (this.done[kind] ?? 0) + n;
    this.done[`${kind}Skipped`] = (this.done[`${kind}Skipped`] ?? 0) + n;
  }

  private error(what: string, why: string) {
    if (this.errors.length < MAX_ERRORS) this.errors.push({ what, why });
  }

  private next() {
    this.phase = PHASES[PHASES.indexOf(this.phase) + 1];
    this.offset = 0;
  }

  private async mapped(kind: string, sourceId: string) {
    const [row] = await db
      .select({ destId: migrationMap.destId })
      .from(migrationMap)
      .where(
        and(
          eq(migrationMap.photographerId, this.photographerId),
          eq(migrationMap.source, this.source),
          eq(migrationMap.kind, kind),
          eq(migrationMap.sourceId, sourceId),
        ),
      );
    return row ? { id: row.destId } : null;
  }

  private async remember(kind: string, sourceId: string, destId: string | null) {
    await db
      .insert(migrationMap)
      .values({ photographerId: this.photographerId, source: this.source, kind, sourceId, destId })
      .onConflictDoUpdate({ target: [migrationMap.photographerId, migrationMap.source, migrationMap.kind, migrationMap.sourceId], set: { destId } });
  }

  async runPhase(deadline: number) {
    const inc = this.include;
    switch (this.phase) {
      case "clients": {
        // Clients off: only the ones the chosen galleries need.
        const needed = inc && !inc.clients ? new Set(inc.clientIds) : null;
        if (needed && needed.size === 0) return this.next();
        return this.page<MClient>("clients", 100, (c) => (needed && !needed.has(c.id) ? Promise.resolve() : this.client(c)));
      }
      case "addons":
        if (inc && !inc.sessions) return this.next();
        return this.page<MAddon>("addons", 100, (a) => this.addon(a));
      case "session_types":
        if (inc && !inc.sessions) return this.next();
        return this.page<MSessionType>("session-types", 20, (s) => this.sessionType(s));
      case "contracts":
        if (inc && !inc.contracts) return this.next();
        return this.page<MContract>("contracts", 50, (c) => this.contract(c));
      case "galleries":
        if (inc && inc.galleryIds.length === 0) return this.next();
        return this.gallery(deadline);
      // Version 2 parts: only when chosen (so never for older imports).
      case "bookings":
        if (!inc?.bookings) return this.next();
        return this.page<MBooking>("bookings", 5, (b) => this.booking(b));
      case "credits":
        if (!inc?.credits) return this.next();
        return this.page<MCredit>("credits", 100, (c) => this.credit(c));
      case "reviews":
        if (!inc?.reviews) return this.next();
        return this.page<MReview>("reviews", 100, (r) => this.review(r));
      case "invoices":
        if (!inc?.invoices) return this.next();
        return this.page<MInvoice>("invoices", 20, (i) => this.invoice(i));
    }
  }

  private async page<T>(endpoint: string, limit: number, each: (item: T) => Promise<void>) {
    const page = await this.remote.get<Page<T>>(endpoint, { offset: this.offset, limit });
    for (const item of page.items ?? []) await each(item);
    if (page.next === null || page.next === undefined) this.next();
    else this.offset = page.next;
  }

  // ---- Records ----

  private async client(c: MClient) {
    if (await this.mapped("client", c.id)) return this.alreadyHere("clients");
    {
      const email = c.email?.trim().toLowerCase() || null;
      // The same person already here (by email): keep them, don't duplicate.
      const [existing] = email
        ? await db
            .select({ id: clients.id })
            .from(clients)
            .where(and(eq(clients.photographerId, this.photographerId), sql`lower(${clients.email}) = ${email}`))
            .limit(1)
        : [];
      const id =
        existing?.id ??
        (
          await db
            .insert(clients)
            .values({ photographerId: this.photographerId, name: (c.name || email || "Client").slice(0, 120), email, phone: c.phone?.slice(0, 40) || null, notes: c.notes || null })
            .returning({ id: clients.id })
        )[0].id;
      await this.remember("client", c.id, id);
      if (existing) return this.alreadyHere("clients");
    }
    this.count("clients");
  }

  private async byName<T extends { id: string }>(rows: T[]) {
    return rows[0]?.id ?? null;
  }

  private async addon(a: MAddon) {
    if (await this.mapped("addon", a.id)) return this.alreadyHere("addons");
    {
      const existing = await this.byName(
        await db
          .select({ id: addons.id })
          .from(addons)
          .where(and(eq(addons.photographerId, this.photographerId), sql`lower(trim(${addons.name})) = ${a.name.trim().toLowerCase()}`))
          .limit(1),
      );
      const id =
        existing ??
        (
          await db
            .insert(addons)
            .values({
              photographerId: this.photographerId,
              name: a.name.slice(0, 120),
              description: a.description || null,
              priceCents: Math.max(0, Math.round(a.priceCents)),
              // WordPress uses 0 for "no limit"; here the most is 500.
              maxQuantity: a.maxQuantity > 0 ? Math.min(500, a.maxQuantity) : 500,
            })
            .returning({ id: addons.id })
        )[0].id;
      await this.remember("addon", a.id, id);
      if (existing) return this.alreadyHere("addons");
    }
    this.count("addons");
  }

  private async sessionType(s: MSessionType) {
    if (await this.mapped("session_type", s.id)) return this.alreadyHere("sessionTypes");
    {
      const existing = await this.byName(
        await db
          .select({ id: sessionTypes.id })
          .from(sessionTypes)
          .where(and(eq(sessionTypes.photographerId, this.photographerId), sql`lower(trim(${sessionTypes.name})) = ${s.name.trim().toLowerCase()}`))
          .limit(1),
      );
      if (existing) {
        // Keep the studio's own; don't change it or add a duplicate.
        await this.remember("session_type", s.id, existing);
        return this.alreadyHere("sessionTypes");
      } else {
        const id = randomUUID();
        let imageKey: string | null = null;
        if (s.imageUrl) {
          try {
            const response = await fetch(s.imageUrl, { signal: AbortSignal.timeout(30_000) });
            if (response.ok) {
              const jpeg = await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
              imageKey = sessionImageKey(this.photographerId, id, randomBytes(6).toString("hex"));
              await putObject(imageKey, jpeg, "image/jpeg");
            }
          } catch {
            this.error(`Session "${s.name}"`, "Its picture couldn't be copied; add one in Booking setup.");
          }
        }
        await db.insert(sessionTypes).values({
          id,
          photographerId: this.photographerId,
          name: s.name.slice(0, 120),
          shortDescription: s.shortDescription?.slice(0, 300) || null,
          description: s.descriptionHtml ? sanitizeRichText(s.descriptionHtml) : null,
          durationMinutes: Math.max(5, Math.min(24 * 60, Math.round(s.durationMinutes) || 60)),
          priceCents: Math.max(0, Math.round(s.priceCents)),
          depositPercent: Math.max(0, Math.min(100, Math.round(s.depositPercent))),
          location: locationCode(s.location),
          photosIncluded: s.photosIncluded ?? null,
          hidden: this.hideSessions || s.hidden,
          sortOrder: s.sortOrder ?? 0,
          imageKey,
        });
        for (const link of s.addons ?? []) {
          const addon = await this.mapped("addon", link.addonId);
          if (addon?.id) {
            await db
              .insert(sessionTypeAddons)
              .values({ sessionTypeId: id, addonId: addon.id, includedQuantity: Math.max(0, link.includedQuantity || 0) })
              .onConflictDoNothing();
          }
        }
        await this.remember("session_type", s.id, id);
      }
    }
    this.count("sessionTypes");
  }

  private async contract(c: MContract) {
    if (await this.mapped("contract", c.id)) return this.alreadyHere("contracts");
    {
      const existing = await this.byName(
        await db
          .select({ id: contractTemplates.id })
          .from(contractTemplates)
          .where(and(eq(contractTemplates.photographerId, this.photographerId), sql`lower(trim(${contractTemplates.title})) = ${c.title.trim().toLowerCase()}`))
          .limit(1),
      );
      let id = existing;
      if (!id) {
        // Only becomes the default when the studio doesn't have one yet.
        const [hasDefault] = await db
          .select({ id: contractTemplates.id })
          .from(contractTemplates)
          .where(and(eq(contractTemplates.photographerId, this.photographerId), eq(contractTemplates.isDefault, true)))
          .limit(1);
        id = (
          await db
            .insert(contractTemplates)
            .values({ photographerId: this.photographerId, title: c.title.slice(0, 150), content: sanitizeRichText(c.contentHtml), isDefault: c.isDefault && !hasDefault })
            .returning({ id: contractTemplates.id })
        )[0].id;
      }
      await this.remember("contract", c.id, id);
      if (existing) return this.alreadyHere("contracts");
    }
    this.count("contracts");
  }

  // ---- Galleries ----

  // One gallery at a time: make it, bring in its photos until the step's
  // time is up, and once every photo is in, the client's picks and notes.
  private async gallery(deadline: number) {
    const page = await this.remote.get<Page<MGallery>>("galleries", { offset: this.offset, limit: 1 });
    const g = page.items?.[0];
    if (!g) return this.next();
    // Not one of the galleries the studio chose.
    if (this.include && !this.include.galleryIds.includes(g.id)) {
      this.offset++;
      return;
    }

    const mappedGallery = await this.mapped("gallery", g.id);
    if (await this.mapped("gallery_done", g.id)) {
      // Brought over before.
      this.alreadyHere("galleries");
      this.alreadyHere("photos", g.photos.length);
      this.offset++;
      return;
    }
    let galleryId = mappedGallery?.id ?? null;
    if (!galleryId) {
      const active = g.status !== "completed" && g.status !== "expired";
      if (active) {
        const full = await galleryLimitError(this.photographerId);
        if (full) throw new ImportError(full);
      }
      const client = g.clientId ? await this.mapped("client", g.clientId) : null;
      const createdAt = new Date(g.createdAt);
      const [row] = await db
        .insert(galleries)
        .values({
          photographerId: this.photographerId,
          clientId: client?.id ?? null,
          title: g.title.slice(0, 200) || "Gallery",
          shareToken: randomBytes(18).toString("base64url"),
          status: g.status,
          freeLimit: Math.max(0, g.freeLimit || 0),
          extraPhotoPriceCents: g.extraPhotoPriceCents,
          notesEnabled: g.notesEnabled,
          submittedAt: g.status === "pending" ? null : g.deliveredAt ? new Date(g.deliveredAt) : createdAt,
          deliveredAt: g.deliveredAt ? new Date(g.deliveredAt) : null,
          expiresAt: g.expiresAt ? new Date(g.expiresAt) : null,
          createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        })
        .returning({ id: galleries.id });
      galleryId = row.id;
      await this.remember("gallery", g.id, galleryId);
    }

    for (const photo of g.photos) {
      if (Date.now() >= deadline) return; // Continues with this gallery next step.
      if (await this.mapped("photo", photo.id)) continue;
      await this.photo(galleryId, g, photo);
    }

    // Every photo is in: the client's picks and notes.
    for (const photo of g.photos.filter((p) => p.kind === "proof" && p.selected)) {
      const mapped = await this.mapped("photo", photo.id);
      if (mapped?.id) await db.insert(favorites).values({ photoId: mapped.id, note: photo.note?.slice(0, 500) || null }).onConflictDoNothing();
    }
    await this.remember("gallery_done", g.id, galleryId);
    this.count("galleries");
    this.offset++;
  }

  private async photo(galleryId: string, g: MGallery, p: MGallery["photos"][number]) {
    const what = `Photo ${p.name} in "${g.title}"`;
    const type = (PHOTO_TYPES as readonly string[]).includes(p.contentType) ? (p.contentType as (typeof PHOTO_TYPES)[number]) : null;
    if (!type) {
      this.error(what, "Only JPEG, PNG, and WebP photos can be imported.");
      return this.remember("photo", p.id, null);
    }
    if (p.sizeBytes && p.sizeBytes > MAX_PHOTO_BYTES) {
      this.error(what, "Photos must be 50 MB or smaller.");
      return this.remember("photo", p.id, null);
    }
    const full = await storageLimitError(this.photographerId, p.sizeBytes ?? 0);
    if (full) throw new ImportError(full);

    let original: Buffer;
    try {
      original = await this.remote.original(p.id);
    } catch (e) {
      this.error(what, e instanceof Error ? e.message : "It couldn't be downloaded.");
      return this.remember("photo", p.id, null);
    }
    if (original.length > MAX_PHOTO_BYTES) {
      this.error(what, "Photos must be 50 MB or smaller.");
      return this.remember("photo", p.id, null);
    }

    let variants: Awaited<ReturnType<typeof makeVariants>>;
    try {
      variants = await makeVariants(original, p.kind === "proof" ? await this.loadWatermark() : null);
    } catch {
      this.error(what, "It isn't a photo we can read.");
      return this.remember("photo", p.id, null);
    }

    const id = randomUUID();
    const prefix = photoPrefix(this.photographerId, galleryId, id);
    await Promise.all([
      putObject(photoKey(prefix, "original"), original, type),
      putObject(photoKey(prefix, "preview"), variants.preview, "image/jpeg"),
      putObject(photoKey(prefix, "thumb"), variants.thumb, "image/jpeg"),
      variants.proof ? putObject(photoKey(prefix, "proof"), variants.proof, "image/jpeg") : Promise.resolve(),
    ]);
    const [{ last }] = await db
      .select({ last: max(photos.position) })
      .from(photos)
      .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, p.kind)));
    await db.insert(photos).values({
      id,
      galleryId,
      kind: p.kind,
      fileKey: prefix,
      originalName: p.name.slice(0, 255),
      contentType: type,
      width: variants.width || null,
      height: variants.height || null,
      sizeBytes: original.length,
      position: (last ?? 0) + 1,
      proofMadeAt: variants.proof ? new Date() : null,
    });
    await this.remember("photo", p.id, id);
    this.count("photos");
  }

  // ---- Version 2: bookings, credits, reviews, quotes/invoices ----

  // The client for a booking or invoice: the one imported for it, or the same
  // email already here, or a new one.
  private async clientFor(sourceId: string | null, name: string, email: string, phone: string | null) {
    const mapped = sourceId ? await this.mapped("client", sourceId) : null;
    if (mapped?.id) return mapped.id;
    const clean = email.trim().toLowerCase();
    if (!clean) return null;
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.photographerId, this.photographerId), sql`lower(${clients.email}) = ${clean}`))
      .limit(1);
    if (existing) return existing.id;
    const [row] = await db
      .insert(clients)
      .values({ photographerId: this.photographerId, name: (name || clean).slice(0, 120), email: clean, phone: phone?.slice(0, 40) || null })
      .returning({ id: clients.id });
    return row.id;
  }

  private async booking(b: MBooking) {
    if (await this.mapped("booking", b.id)) return this.alreadyHere("bookings");
    const startsAt = new Date(b.startsAt);
    const endsAt = new Date(b.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      this.error(`Booking for ${b.clientName}`, "Its date couldn't be read.");
      return this.remember("booking", b.id, null);
    }
    const sessionType = b.sessionTypeId ? await this.mapped("session_type", b.sessionTypeId) : null;
    const clientId = await this.clientFor(b.clientId, b.clientName, b.clientEmail, b.clientPhone);
    const createdAt = new Date(b.createdAt);
    const total = Math.max(0, Math.round(b.totalCents));
    const addonsCents = Math.max(0, Math.min(total, Math.round(b.addonsCents)));
    // Over, or cancelled: its reminders belong to the old system. An upcoming
    // one carries on as normal here (reminder, then the balance).
    const settled = b.status !== "confirmed" || startsAt < new Date();
    const id = randomUUID();
    await db.insert(bookings).values({
      id,
      photographerId: this.photographerId,
      sessionTypeId: sessionType?.id ?? null,
      clientId,
      sessionName: b.sessionName.slice(0, 120) || "Session",
      title: b.title?.slice(0, 200) || null,
      priceCents: total - addonsCents,
      addonsCents,
      depositPercent: Math.max(0, Math.min(100, Math.round(b.depositPercent))),
      creditCents: Math.max(0, Math.round(b.creditCents)),
      startsAt,
      endsAt: endsAt > startsAt ? endsAt : new Date(startsAt.getTime() + 60 * 60 * 1000),
      status: b.status,
      clientName: b.clientName.slice(0, 120) || "Client",
      clientEmail: b.clientEmail.trim().toLowerCase(),
      clientPhone: b.clientPhone?.slice(0, 40) || null,
      notes: b.notes || null,
      manageToken: randomBytes(24).toString("base64url"),
      cancelledAt: b.cancelledAt ? new Date(b.cancelledAt) : b.status === "cancelled" ? new Date() : null,
      reminderSentAt: settled ? new Date() : null,
      balanceReminderSentAt: settled ? new Date() : null,
      answers: b.answers.filter((a) => a.label && a.value).map((a) => ({ label: a.label.slice(0, 200), type: "text" as const, value: a.value.slice(0, 2000) })),
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    });
    for (const a of b.addons) {
      const addon = a.addonId ? await this.mapped("addon", a.addonId) : null;
      await db.insert(bookingAddons).values({
        bookingId: id,
        addonId: addon?.id ?? null,
        name: a.name.slice(0, 120) || "Extra",
        priceCents: Math.max(0, Math.round(a.priceCents)),
        quantity: Math.max(0, Math.round(a.quantity)),
        includedQuantity: Math.max(0, Math.round(a.includedQuantity)),
      });
    }
    // What the client already paid on the old system, so the balance is right.
    if (b.paidCents > 0) await this.paidBefore({ bookingId: id, kind: "deposit" }, b.paidCents, createdAt);
    if (b.signedContract) {
      const s = signature(b.signedContract);
      if (s) await db.insert(signedContracts).values({ bookingId: id, title: s.title ?? "Contract", content: s.content, signerName: s.signerName, signatureType: s.signatureType, signatureData: s.signatureData, signedAt: s.signedAt, clientIp: s.clientIp });
    }
    for (const [n, photo] of b.inspoPhotos.entries()) {
      try {
        const jpeg = await sharp(await this.remote.original(photo.id)).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        const key = inspoKey(this.photographerId, id, n);
        await putObject(key, jpeg, "image/jpeg");
        await db.insert(bookingInspoPhotos).values({ bookingId: id, fileKey: key, position: n });
      } catch {
        this.error(`Inspiration photo for ${b.clientName}'s booking`, "It couldn't be copied.");
      }
    }
    // The booking's gallery, when that gallery came over too.
    const gallery = b.galleryId ? await this.mapped("gallery", b.galleryId) : null;
    if (gallery?.id) {
      await db.update(galleries).set({ bookingId: id }).where(and(eq(galleries.id, gallery.id), isNull(galleries.bookingId)));
    }
    await this.remember("booking", b.id, id);
    this.count("bookings");
  }

  // A payment made before the move, recorded as paid (no Stripe charge here).
  private async paidBefore(target: { bookingId: string; kind: "deposit" }, cents: number, when: Date) {
    await db.insert(payments).values({
      ...target,
      amountCents: Math.round(cents),
      status: "paid",
      stripeAccountId: "imported",
      stripeCheckoutSessionId: `imported_${randomUUID()}`,
      paidAt: Number.isNaN(when.getTime()) ? new Date() : when,
    });
  }

  private async credit(c: MCredit) {
    if (await this.mapped("credit", c.id)) return this.alreadyHere("credits");
    {
      const source = c.sourceBookingId ? await this.mapped("booking", c.sourceBookingId) : null;
      const createdAt = new Date(c.createdAt);
      const [row] = await db
        .insert(sessionCredits)
        .values({
          photographerId: this.photographerId,
          clientEmail: c.clientEmail.trim().toLowerCase(),
          clientName: c.clientName.slice(0, 120) || c.clientEmail,
          amountCents: Math.max(0, Math.round(c.amountCents)),
          usedCents: Math.max(0, Math.min(Math.round(c.amountCents), Math.round(c.usedCents))),
          reason: c.reason.slice(0, 200) || "Credit",
          sourceBookingId: source?.id ?? null,
          expiresOn: /^\d{4}-\d{2}-\d{2}$/.test(c.expiresOn ?? "") ? c.expiresOn : null,
          createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        })
        .returning({ id: sessionCredits.id });
      await this.remember("credit", c.id, row.id);
    }
    this.count("credits");
  }

  private async review(r: MReview) {
    if (await this.mapped("review", r.id)) return this.alreadyHere("reviews");
    {
      const gallery = r.galleryId ? await this.mapped("gallery", r.galleryId) : null;
      // A gallery has one review; one already here wins.
      const [taken] = gallery?.id ? await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.galleryId, gallery.id)) : [];
      if (taken) return this.remember("review", r.id, taken.id).then(() => this.alreadyHere("reviews"));
      const photo = r.photoId ? await this.mapped("photo", r.photoId) : null;
      const date = (v: string | null) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null);
      const [row] = await db
        .insert(reviews)
        .values({
          photographerId: this.photographerId,
          galleryId: gallery?.id ?? null,
          clientName: r.clientName.slice(0, 120) || "Client",
          clientEmail: r.clientEmail.trim().toLowerCase(),
          token: randomBytes(24).toString("base64url"),
          status: r.status,
          displayName: r.displayName?.slice(0, 80) || null,
          rating: r.rating === null ? null : Math.max(1, Math.min(5, Math.round(r.rating))),
          body: r.body || null,
          photoId: photo?.id ?? null,
          photoConsent: r.photoConsent,
          requestedAt: date(r.requestedAt) ?? new Date(),
          submittedAt: date(r.submittedAt),
          approvedAt: date(r.approvedAt),
        })
        .returning({ id: reviews.id });
      await this.remember("review", r.id, row.id);
    }
    this.count("reviews");
  }

  private async invoice(i: MInvoice) {
    if (await this.mapped("invoice", i.id)) return this.alreadyHere("invoices");
    {
      const timeZone = await this.loadTimeZone();
      const createdAt = Number.isNaN(new Date(i.createdAt).getTime()) ? new Date() : new Date(i.createdAt);
      const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
      const total = Math.max(0, Math.round(i.totalCents));
      const paid = Math.max(0, Math.min(total, Math.round(i.paidCents)));
      const plan: PaymentPlan = i.depositPercent > 0 && i.depositPercent < 100 ? { mode: "deposit", depositPercent: Math.round(i.depositPercent) } : { mode: "full" };
      const schedule = buildSchedule(total, plan, day(i.dueDate));
      // The number it had, unless this studio already uses it.
      const number = (await this.numberFree(i.number)) ? i.number.slice(0, 40) : await nextNumber(this.photographerId, i.kind, Number(localDateOf(createdAt, timeZone).slice(0, 4)));
      let status = i.status;
      if (paid > 0 && (status === "sent" || status === "approved")) status = statusAfterPayment(total, paid);
      // Reminders the old system already took care of aren't sent again: the
      // quote nudge, and a payment that's already overdue.
      const due = nextScheduled(schedule, paid);
      const today = localDateOf(new Date(), timeZone);
      const overdueKey = due?.dueDate && due.dueDate < today ? `${due.index}:${due.dueDate}` : null;
      const s = i.signedContract ? signature(i.signedContract) : null;
      const [row] = await db
        .insert(invoices)
        .values({
          photographerId: this.photographerId,
          clientId: await this.clientFor(i.clientId, i.clientName, i.clientEmail, i.clientPhone),
          kind: i.kind,
          number,
          status,
          clientName: i.clientName.slice(0, 120) || "Client",
          clientEmail: i.clientEmail.trim().toLowerCase(),
          clientPhone: i.clientPhone?.slice(0, 40) || null,
          title: i.title.slice(0, 500) || "Invoice",
          eventDate: day(i.eventDate),
          items: i.items.map((li) => ({ description: li.description.slice(0, 500), quantity: Number(li.quantity) || 1, unitCents: Math.round(li.unitCents) })),
          taxBps: Math.max(0, Math.round(i.taxBps)),
          subtotalCents: Math.round(i.subtotalCents),
          taxCents: Math.round(i.taxCents),
          totalCents: total,
          plan,
          schedule,
          dueDate: finalDueDate(schedule),
          paidCents: paid,
          manualPayments: paid > 0 ? [{ amountCents: paid, note: "Paid before moving to PhotoEZ Cloud", date: (i.paidAt ?? i.createdAt).slice(0, 10) }] : [],
          notes: i.notes || null,
          terms: i.terms || null,
          token: newInvoiceToken(),
          contractTitle: s?.title ?? null,
          contractContent: s?.content ?? null,
          signerName: s?.signerName ?? null,
          signatureType: s?.signatureType ?? null,
          signatureData: s?.signatureData ?? null,
          signedAt: s?.signedAt ?? null,
          signerIp: s?.clientIp ?? null,
          sentAt: status === "draft" ? null : createdAt,
          approvedAt: i.approvedAt ? new Date(i.approvedAt) : null,
          paidAt: status === "paid" ? (i.paidAt ? new Date(i.paidAt) : createdAt) : null,
          cancelledAt: status === "cancelled" ? createdAt : null,
          approvalReminderAt: i.kind === "quote" ? new Date() : null,
          overdueNoticeKey: overdueKey,
          createdAt,
        })
        .returning({ id: invoices.id });
      await this.remember("invoice", i.id, row.id);
    }
    this.count("invoices");
  }

  private async numberFree(number: string) {
    if (!number.trim()) return false;
    const [taken] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.photographerId, this.photographerId), eq(invoices.number, number.slice(0, 40))))
      .limit(1);
    return !taken;
  }

  private timeZone: string | undefined;
  private async loadTimeZone() {
    if (this.timeZone) return this.timeZone;
    const [studio] = await db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, this.photographerId));
    this.timeZone = studio?.timeZone ?? "America/Los_Angeles";
    return this.timeZone;
  }

  // The studio's watermark, loaded once per step (null when it has none).
  private async loadWatermark() {
    if (this.watermark !== undefined) return this.watermark;
    const [studio] = await db
      .select({ key: photographers.watermarkKey, opacity: photographers.watermarkOpacity, position: photographers.watermarkPosition })
      .from(photographers)
      .where(eq(photographers.id, this.photographerId));
    const image = studio?.key ? await readObject(studio.key) : null;
    this.watermark = image ? { image: Buffer.from(image), opacity: studio.opacity, position: studio.position } : null;
    return this.watermark;
  }
}

// WordPress keeps the location as free text; PhotoEZ Cloud has three kinds.
export function locationCode(text: string | null): "studio" | "outdoor" | "on_location" | null {
  const t = (text ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("studio")) return "studio";
  if (/outdoor|outside|park|beach|nature/.test(t)) return "outdoor";
  return "on_location";
}

// A signed contract from the other side, cleaned up; null when it can't be
// trusted (no signature, or an unreadable date).
export function signature(s: MSignature) {
  const signedAt = new Date(s.signedAt);
  if (Number.isNaN(signedAt.getTime()) || !s.signatureData || !s.contentHtml) return null;
  const drawn = s.signatureType === "draw" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.signatureData);
  return {
    title: s.title?.slice(0, 200) || null,
    content: sanitizeRichText(s.contentHtml),
    signerName: (s.signerName || (drawn ? "" : s.signatureData)).slice(0, 120) || "Client",
    signatureType: drawn ? ("draw" as const) : ("type" as const),
    signatureData: drawn ? s.signatureData : s.signatureData.slice(0, 120),
    signedAt,
    clientIp: s.clientIp?.slice(0, 64) || null,
  };
}
