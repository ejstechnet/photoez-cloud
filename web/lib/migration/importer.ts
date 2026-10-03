import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, max, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addons,
  clients,
  contractTemplates,
  favorites,
  galleries,
  migrationImports,
  migrationMap,
  photographers,
  photos,
  sessionTypeAddons,
  sessionTypes,
} from "@/db/schema";
import { galleryLimitError, storageLimitError } from "@/lib/plan-usage";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/photo-limits";
import { sanitizeRichText } from "@/lib/rich-text";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { photoKey, photoPrefix, putObject, readObject, sessionImageKey } from "@/lib/storage";
import { MIGRATION_FORMAT, chosenTotals, type ImportChoice, type MAddon, type MClient, type MContract, type MGallery, type MSessionType, type Manifest, type Page } from "./format";
import { makeVariants, type Watermark } from "./variants";
import sharp from "sharp";

// Imports a studio from PhotoEZ for WordPress (the PhotoEZ Migration plugin's
// read-only API, docs/migration-format.md), a little at a time: each step runs
// for up to ~20 seconds and saves where it got to, and the Settings page keeps
// calling the next step with a progress bar. Order: clients → add-ons →
// session types → contracts → galleries (each gallery's photos right after it).
// Anything already here with the same email or name is reused, not duplicated.

const STEP_MS = 20_000;
const PHASES = ["clients", "addons", "session_types", "contracts", "galleries", "done"] as const;
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
    done: { clients: 0, addons: 0, sessionTypes: 0, contracts: 0, galleries: 0, photos: 0 },
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
    if (!(await this.mapped("client", c.id))) {
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
    }
    this.count("clients");
  }

  private async byName<T extends { id: string }>(rows: T[]) {
    return rows[0]?.id ?? null;
  }

  private async addon(a: MAddon) {
    if (!(await this.mapped("addon", a.id))) {
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
    }
    this.count("addons");
  }

  private async sessionType(s: MSessionType) {
    if (!(await this.mapped("session_type", s.id))) {
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
    if (!(await this.mapped("contract", c.id))) {
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
