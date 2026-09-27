"use server";

import { randomBytes } from "node:crypto";
import { and, asc, count, eq, max, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { photographers, studioFaqs, studioPhotos } from "@/db/schema";
import { MAX_FAQS } from "@/lib/faq";
import { cleanRichTextInput, richTextToPlain } from "@/lib/rich-text";
import { requirePhotographer } from "@/lib/session";
import { testEmail } from "@/lib/email/messages";
import { sendToStudio, studioSender } from "@/lib/email/send";
import { deletePrefix, headshotKey, signedUploadUrl, storedSize, studioLogoKey, studioPhotoKey, watermarkKey } from "@/lib/storage";
import { MAX_WATERMARK_BYTES, WATERMARK_POSITIONS } from "@/lib/watermark";
import { OFFERABLE_TYPES, SHOOT_LOCATIONS } from "@/lib/session-types";
import { MAX_STUDIO_PHOTOS, isAllowedSlug } from "@/lib/studio";
import { moveInList } from "@/lib/reorder";
import { parseAmountList } from "@/lib/gift-card-rules";
import { lookupZip } from "@/lib/geo/zips";

// Step 1 of replacing the watermark: a one-time link to upload the new PNG.
export async function prepareWatermarkUpload(
  file: { type: string; size: number },
): Promise<{ version: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  if (file.type !== "image/png") return { error: "Use a PNG file, ideally with a transparent background." };
  if (file.size > MAX_WATERMARK_BYTES) return { error: "Keep the watermark under 5 MB." };

  const version = randomBytes(6).toString("hex");
  return { version, url: await signedUploadUrl(watermarkKey(photographer.id, version), "image/png") };
}

const settingsSchema = z.object({
  opacity: z.coerce.number().int().min(5, "Pick at least 5%.").max(100),
  position: z.enum(WATERMARK_POSITIONS),
  // Set when a new watermark file was just uploaded (step 2).
  newVersion: z
    .string()
    .regex(/^[a-f0-9]{12}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type WatermarkFormState = { message?: string; saved?: boolean };

export async function saveWatermarkSettings(
  _prev: WatermarkFormState,
  formData: FormData,
): Promise<WatermarkFormState> {
  const photographer = await requirePhotographer();
  const parsed = settingsSchema.safeParse({
    opacity: formData.get("opacity"),
    position: formData.get("position"),
    newVersion: formData.get("newVersion") ?? "",
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check your watermark settings." };

  const [current] = await db
    .select({ key: photographers.watermarkKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));

  let key = current?.key ?? null;
  if (parsed.data.newVersion) {
    const newKey = watermarkKey(photographer.id, parsed.data.newVersion);
    const size = await storedSize(newKey);
    if (size === null) return { message: "The watermark upload didn't finish. Try again." };
    if (size > MAX_WATERMARK_BYTES) {
      await deletePrefix(newKey);
      return { message: "Keep the watermark under 5 MB." };
    }
    if (key) await deletePrefix(key);
    key = newKey;
  }
  if (!key) return { message: "Upload a watermark first." };

  await db
    .update(photographers)
    .set({
      watermarkKey: key,
      watermarkOpacity: parsed.data.opacity,
      watermarkPosition: parsed.data.position,
      // Every existing proof now needs the new look.
      watermarkUpdatedAt: new Date(),
    })
    .where(eq(photographers.id, photographer.id));

  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

// ---- Studio logo ----
// Same two steps as the watermark: a one-time upload link, then a save that
// checks the file really arrived.

const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function prepareLogoUpload(file: {
  type: string;
  size: number;
}): Promise<{ version: string; extension: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  const extension = LOGO_TYPES[file.type as keyof typeof LOGO_TYPES];
  if (!extension) return { error: "Use a PNG, JPG, or WebP image." };
  if (file.size > MAX_LOGO_BYTES) return { error: "Keep the logo under 5 MB." };

  const version = randomBytes(6).toString("hex");
  const url = await signedUploadUrl(studioLogoKey(photographer.id, version, extension), file.type);
  return { version, extension, url };
}

export async function saveStudioLogo(version: string, extension: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!/^[a-f0-9]{12}$/.test(version) || !Object.values(LOGO_TYPES).includes(extension as "png")) {
    return { error: "That upload couldn't be saved." };
  }
  const key = studioLogoKey(photographer.id, version, extension);
  const size = await storedSize(key);
  if (size === null) return { error: "The logo upload didn't finish. Try again." };
  if (size > MAX_LOGO_BYTES) {
    await deletePrefix(key);
    return { error: "Keep the logo under 5 MB." };
  }

  const [current] = await db
    .select({ key: photographers.studioLogoKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (current?.key) await deletePrefix(current.key);

  await db.update(photographers).set({ studioLogoKey: key }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
  return { ok: true };
}

// The card color behind the logo, so logos with white (or any color) stay visible.
export async function saveLogoBackground(color: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  const value = color.trim().toLowerCase();
  if (value !== "transparent" && !/^#[0-9a-f]{6}$/.test(value)) return { error: "Pick a color from the list." };
  await db.update(photographers).set({ studioLogoBg: value }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
  return { ok: true };
}

export async function removeStudioLogo(): Promise<void> {
  const photographer = await requirePhotographer();
  const [current] = await db
    .select({ key: photographers.studioLogoKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (current?.key) await deletePrefix(current.key);
  await db.update(photographers).set({ studioLogoKey: null }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
}

// ---- Studio profile ----

const typeList = z.array(z.enum(OFFERABLE_TYPES));

const studioSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your studio's name.").max(120),
  studioSlug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isAllowedSlug, "Use 3–40 lowercase letters, numbers, and single hyphens (like elle-jones-studios)."),
  studioTagline: z.string().trim().max(140).transform((v) => v || null),
  studioBio: z
    .string()
    .max(20000, "That's too long for the About section.")
    .transform(cleanRichTextInput)
    .refine((v) => v === null || richTextToPlain(v).length <= 2000, "Keep the About section under 2,000 characters."),
  serviceArea: z.string().trim().max(120).transform((v) => v || null),
  offeredTypes: typeList.min(1, "Pick at least one session type you offer."),
  shootLocations: z.array(z.enum(SHOOT_LOCATIONS)).min(1, "Pick at least one place you shoot."),
  quoteOnlyTypes: typeList,
});

export type StudioFormState = {
  errors?: Partial<Record<keyof z.input<typeof studioSchema>, string>>;
  saved?: boolean;
};

export async function saveStudioProfile(_prev: StudioFormState, formData: FormData): Promise<StudioFormState> {
  const photographer = await requirePhotographer();
  const parsed = studioSchema.safeParse({
    businessName: String(formData.get("businessName") ?? ""),
    studioSlug: String(formData.get("studioSlug") ?? ""),
    studioTagline: String(formData.get("studioTagline") ?? ""),
    studioBio: String(formData.get("studioBio") ?? ""),
    serviceArea: String(formData.get("serviceArea") ?? ""),
    offeredTypes: formData.getAll("offeredTypes").map(String),
    shootLocations: formData.getAll("shootLocations").map(String),
    quoteOnlyTypes: formData.getAll("quoteOnlyTypes").map(String),
  });
  if (!parsed.success) {
    const errors: StudioFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof z.input<typeof studioSchema>;
      errors[field] ??= issue.message;
    }
    return { errors };
  }

  // The page address must be unique across all studios.
  const [taken] = await db
    .select({ id: photographers.id })
    .from(photographers)
    .where(and(eq(photographers.studioSlug, parsed.data.studioSlug), ne(photographers.id, photographer.id)));
  if (taken) return { errors: { studioSlug: "That address is taken. Try adding your city or last name." } };

  // A quote-only service must also be one you offer.
  const quoteOnlyTypes = parsed.data.quoteOnlyTypes.filter((type) => parsed.data.offeredTypes.includes(type));

  await db
    .update(photographers)
    .set({ ...parsed.data, quoteOnlyTypes, updatedAt: new Date() })
    .where(eq(photographers.id, photographer.id));

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/studio/${parsed.data.studioSlug}`);
  return { saved: true };
}

export async function removeWatermark(): Promise<void> {
  const photographer = await requirePhotographer();
  const [current] = await db
    .select({ key: photographers.watermarkKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (current?.key) await deletePrefix(current.key);

  await db
    .update(photographers)
    .set({ watermarkKey: null, watermarkUpdatedAt: new Date() })
    .where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard", "layout");
}

// ---- Client FAQ ----

export type FaqFormState = { message?: string; saved?: boolean };

// Saves the whole FAQ at once: every question with an answer, in the order
// shown. Questions left unanswered aren't saved (or shown to clients).
export async function saveFaqs(_prev: FaqFormState, formData: FormData): Promise<FaqFormState> {
  const photographer = await requirePhotographer();
  const questions = formData.getAll("question").map((v) => String(v).trim());
  const answers = formData.getAll("answer").map((v) => String(v).trim());
  if (questions.length !== answers.length) return { message: "Something went wrong. Please reload and try again." };

  const rows = questions
    .map((question, i) => ({ question, answer: answers[i] }))
    .filter((row) => row.answer !== "");
  if (rows.some((row) => row.question === "")) return { message: "Every answer needs a question above it." };
  if (rows.length > MAX_FAQS) return { message: `Keep it to ${MAX_FAQS} questions or fewer.` };
  if (rows.some((row) => row.question.length > 200)) return { message: "Keep each question under 200 characters." };
  if (rows.some((row) => row.answer.length > 2000)) return { message: "Keep each answer under 2,000 characters." };

  await db.transaction(async (tx) => {
    await tx.delete(studioFaqs).where(eq(studioFaqs.photographerId, photographer.id));
    if (rows.length > 0) {
      await tx
        .insert(studioFaqs)
        .values(rows.map((row, i) => ({ ...row, sortOrder: i, photographerId: photographer.id })));
    }
  });

  revalidatePath("/dashboard", "layout");
  revalidatePath("/studio/[slug]", "layout");
  return { saved: true };
}

// ---- Plan & gallery extras ----

export type ExtrasFormState = { message?: string; saved?: boolean };

// The studio's price per extra photo (PhotoEZ's global extra price).
export async function saveExtraPhotoPrice(_prev: ExtrasFormState, formData: FormData): Promise<ExtrasFormState> {
  const photographer = await requirePhotographer();
  const value = String(formData.get("extraPhotoPrice") ?? "").trim().replace(/[$,]/g, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(value)) return { message: "Enter a price like 10 or 10.00." };
  await db
    .update(photographers)
    .set({ extraPhotoPriceCents: Math.round(Number(value) * 100) })
    .where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

// Clients can leave a note on each photo they pick (galleries can override).
export async function savePhotoNotes(enabled: boolean): Promise<void> {
  const photographer = await requirePhotographer();
  await db.update(photographers).set({ photoNotesEnabled: enabled }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard", "layout");
}

// ---- Email ----

export type EmailFormState = { message?: string; saved?: boolean };

const reminderValue = (allowed: number[]) =>
  z
    .string()
    .transform((v) => (v === "off" ? null : Number(v)))
    .refine((v) => v === null || allowed.includes(v));

const emailSettingsSchema = z.object({
  notifyEmail: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address, or leave it blank."),
  autoSendReplies: z.boolean(),
  sessionReminderHours: reminderValue([12, 24, 48, 72]),
  balanceReminderDays: reminderValue([1, 2, 3, 7]),
  galleryExpiryReminderDays: reminderValue([1, 3, 7]),
});

export async function saveEmailSettings(_prev: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const photographer = await requirePhotographer();
  const parsed = emailSettingsSchema.safeParse({
    notifyEmail: String(formData.get("notifyEmail") ?? ""),
    autoSendReplies: formData.get("autoSendReplies") === "on",
    sessionReminderHours: String(formData.get("sessionReminderHours") ?? "off"),
    balanceReminderDays: String(formData.get("balanceReminderDays") ?? "off"),
    galleryExpiryReminderDays: String(formData.get("galleryExpiryReminderDays") ?? "off"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Please check the fields." };
  await db.update(photographers).set(parsed.data).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

// Sends a test to the studio's notice address, so the photographer can see
// that email works and how it looks.
export async function sendTestEmail(): Promise<{ ok: string } | { error: string }> {
  const photographer = await requirePhotographer();
  const studio = await studioSender(photographer.id);
  if (!studio) return { error: "Your studio could not be found." };
  const sent = await sendToStudio(photographer.id, "test", testEmail(studio.studioName));
  if (sent) return { ok: `Sent to ${studio.inbox}. Check your inbox (and spam).` };
  return {
    error: process.env.SMTP_HOST
      ? "It couldn't be sent. The Email log has the details."
      : "Email isn't set up on this computer, so it was saved to the Email log instead of sent.",
  };
}

// ---- Reviews ----

export type ReviewFormState = { message?: string; saved?: boolean };

export async function saveReviewSettings(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const photographer = await requirePhotographer();
  const days = String(formData.get("reviewRequestDays") ?? "off");
  const reviewRequestDays = days === "off" ? null : Number(days);
  if (reviewRequestDays !== null && ![1, 3, 5, 7, 14].includes(reviewRequestDays)) {
    return { message: "Choose when to ask for reviews." };
  }
  const url = String(formData.get("googleReviewUrl") ?? "").trim();
  if (url && (!/^https:\/\/\S+$/.test(url) || url.length > 500)) {
    return { message: "Paste the full Google link, starting with https://" };
  }
  await db
    .update(photographers)
    .set({ reviewRequestDays, googleReviewUrl: url || null })
    .where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

// ---- Examples of work (studio page portfolio) ----
// Same two steps as other photos: a one-time upload link for a browser-resized
// JPEG, then a save that checks it arrived. Up to MAX_STUDIO_PHOTOS.

const MAX_STUDIO_PHOTO_BYTES = 4 * 1024 * 1024;

export async function prepareStudioPhotoUpload(
  size: number,
): Promise<{ version: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  const [{ n }] = await db
    .select({ n: count() })
    .from(studioPhotos)
    .where(eq(studioPhotos.photographerId, photographer.id));
  if (n >= MAX_STUDIO_PHOTOS) return { error: `You can show up to ${MAX_STUDIO_PHOTOS} photos. Remove one to add another.` };
  if (size > MAX_STUDIO_PHOTO_BYTES) return { error: "That photo is too large. Try a smaller one." };
  const version = randomBytes(6).toString("hex");
  return { version, url: await signedUploadUrl(studioPhotoKey(photographer.id, version), "image/jpeg") };
}

export async function saveStudioPhoto(version: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!/^[a-f0-9]{12}$/.test(version)) return { error: "That upload couldn't be saved." };
  const key = studioPhotoKey(photographer.id, version);
  const size = await storedSize(key);
  if (size === null) return { error: "The photo upload didn't finish. Try again." };
  const [{ n, last }] = await db
    .select({ n: count(), last: max(studioPhotos.position) })
    .from(studioPhotos)
    .where(eq(studioPhotos.photographerId, photographer.id));
  if (size > MAX_STUDIO_PHOTO_BYTES || n >= MAX_STUDIO_PHOTOS) {
    await deletePrefix(key);
    return { error: n >= MAX_STUDIO_PHOTOS ? `You can show up to ${MAX_STUDIO_PHOTOS} photos.` : "That photo is too large." };
  }
  await db.insert(studioPhotos).values({ photographerId: photographer.id, fileKey: key, position: (last ?? -1) + 1 });
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
  return { ok: true };
}

export async function removeStudioPhoto(photoId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (!z.uuid().safeParse(photoId).success) return;
  const [removed] = await db
    .delete(studioPhotos)
    .where(and(eq(studioPhotos.id, photoId), eq(studioPhotos.photographerId, photographer.id)))
    .returning({ fileKey: studioPhotos.fileKey });
  if (removed) await deletePrefix(removed.fileKey);
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
}

// Moves a portfolio photo one place earlier (-1) or later (1).
export async function moveStudioPhoto(photoId: string, by: -1 | 1): Promise<void> {
  const photographer = await requirePhotographer();
  const rows = await db
    .select({ id: studioPhotos.id })
    .from(studioPhotos)
    .where(eq(studioPhotos.photographerId, photographer.id))
    .orderBy(asc(studioPhotos.position), asc(studioPhotos.createdAt));
  const order = moveInList(
    rows.map((r) => r.id),
    photoId,
    by,
  );
  if (!order) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of order.entries()) {
      await tx.update(studioPhotos).set({ position }).where(eq(studioPhotos.id, id));
    }
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
}

// ---- Gift cards ----

export type GiftSettingsState = { message?: string; saved?: boolean };

export async function saveGiftCardSettings(_prev: GiftSettingsState, formData: FormData): Promise<GiftSettingsState> {
  const photographer = await requirePhotographer();
  const amounts = parseAmountList(String(formData.get("amounts") ?? ""));
  if (!amounts) return { message: "List up to 6 whole-dollar amounts, like 50, 100, 250." };
  let minCents: number | null = null;
  let maxCents: number | null = null;
  if (formData.get("allowCustom") === "on") {
    const min = String(formData.get("min") ?? "").trim();
    const max = String(formData.get("max") ?? "").trim();
    if (!/^\d{1,5}$/.test(min) || !/^\d{1,5}$/.test(max) || Number(min) < 1 || Number(max) <= Number(min)) {
      return { message: "Enter the smallest and largest amounts, like 25 and 1000." };
    }
    minCents = Number(min) * 100;
    maxCents = Number(max) * 100;
  }
  await db
    .update(photographers)
    .set({
      giftCardsEnabled: formData.get("enabled") === "on",
      giftCardAmounts: amounts,
      giftCardMinCents: minCents,
      giftCardMaxCents: maxCents,
    })
    .where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard", "layout");
  revalidatePath("/studio/[slug]", "layout");
  return { saved: true };
}

// ---- Headshot (About on the studio page) ----

const MAX_HEADSHOT_BYTES = 3 * 1024 * 1024;

export async function prepareHeadshotUpload(size: number): Promise<{ version: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  if (size > MAX_HEADSHOT_BYTES) return { error: "That photo is too large. Try a smaller one." };
  const version = randomBytes(6).toString("hex");
  return { version, url: await signedUploadUrl(headshotKey(photographer.id, version), "image/jpeg") };
}

export async function saveHeadshot(version: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!/^[a-f0-9]{12}$/.test(version)) return { error: "That upload couldn't be saved." };
  const key = headshotKey(photographer.id, version);
  const size = await storedSize(key);
  if (size === null) return { error: "The photo upload didn't finish. Try again." };
  if (size > MAX_HEADSHOT_BYTES) {
    await deletePrefix(key);
    return { error: "That photo is too large. Try a smaller one." };
  }
  const [current] = await db
    .select({ key: photographers.headshotKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (current?.key) await deletePrefix(current.key);
  await db.update(photographers).set({ headshotKey: key }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
  return { ok: true };
}

export async function removeHeadshot(): Promise<void> {
  const photographer = await requirePhotographer();
  const [current] = await db
    .select({ key: photographers.headshotKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (!current?.key) return;
  await deletePrefix(current.key);
  await db.update(photographers).set({ headshotKey: null }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
}

// ---- Photographer directory ----

export type DirectoryFormState = { errors?: { zip?: string }; message?: string; saved?: boolean };

export async function saveDirectoryListing(_prev: DirectoryFormState, formData: FormData): Promise<DirectoryFormState> {
  const photographer = await requirePhotographer();
  const zip = String(formData.get("zip") ?? "").trim();
  const listed = formData.get("listed") === "on";
  const place = zip ? lookupZip(zip) : null;
  if (zip && !place) return { errors: { zip: "We couldn't find that ZIP code. Use a 5-digit US ZIP." } };
  if (listed && !place) return { errors: { zip: "Add your ZIP code so clients nearby can find you." } };

  await db
    .update(photographers)
    .set({
      directoryListed: listed,
      directoryZip: place?.zip ?? null,
      directoryCity: place?.city ?? null,
      directoryState: place?.state ?? null,
      directoryLat: place?.lat ?? null,
      directoryLng: place?.lng ?? null,
      updatedAt: new Date(),
    })
    .where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/photographers", "layout");
  return { saved: true };
}
