import Link from "next/link";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookingHours, bookings, galleries, inquiries, photographers, sessionTypes } from "@/db/schema";
import { ArrowRightIcon } from "@/components/icons";
import { setupSteps, showSetupChecklist } from "@/lib/setup-checklist";
import { siteUrl } from "@/lib/site";
import { CopyStudioLink, HideSetupChecklist } from "./setup-checklist-buttons";

// The welcome checklist at the top of the dashboard, until the studio is
// ready for clients (lib/setup-checklist.ts).
export async function SetupChecklist({ photographerId }: { photographerId: string }) {
  const [studio] = await db
    .select({
      slug: photographers.studioSlug,
      logo: photographers.studioLogoKey,
      headshot: photographers.headshotKey,
      stripeReady: photographers.stripeChargesEnabled,
      linkCopiedAt: photographers.setupLinkCopiedAt,
      dismissedAt: photographers.setupDismissedAt,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio || studio.dismissedAt) return null;

  const [[sessions], [hours], [galleryRows], [bookingRows], [found]] = await Promise.all([
    db.select({ n: count() }).from(sessionTypes).where(and(eq(sessionTypes.photographerId, photographerId), eq(sessionTypes.hidden, false))),
    db.select({ n: count() }).from(bookingHours).where(eq(bookingHours.photographerId, photographerId)),
    db.select({ n: count() }).from(galleries).where(eq(galleries.photographerId, photographerId)),
    db.select({ n: count() }).from(bookings).where(eq(bookings.photographerId, photographerId)),
    db.select({ n: count() }).from(inquiries).where(and(eq(inquiries.photographerId, photographerId), inArray(inquiries.source, ["form", "directory"]))),
  ]);

  const steps = setupSteps({
    studioSlug: studio.slug,
    hasPicture: Boolean(studio.logo || studio.headshot),
    stripeReady: studio.stripeReady,
    sessionCount: sessions.n,
    hoursCount: hours.n,
    galleryCount: galleryRows.n,
    linkCopied: Boolean(studio.linkCopiedAt),
    clientFound: bookingRows.n + found.n > 0,
  });
  if (!showSetupChecklist(steps, false)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="card mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-wider text-coral uppercase">Get ready for clients</p>
          <h2 className="mt-1 font-display text-2xl font-bold">Welcome to PhotoEZ Cloud! Here&rsquo;s where to start.</h2>
        </div>
        <HideSetupChecklist />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="Setup progress">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <p className="shrink-0 text-sm font-semibold text-muted">
          {doneCount} of {steps.length} done
        </p>
      </div>
      <ol className="mt-5 grid gap-2 md:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.key}>
            <div
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${step.done ? "border-transparent bg-lime/10" : "border-border"}`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  step.done ? "bg-lime text-brand-deep" : "bg-surface text-muted ring-2 ring-border"
                }`}
                aria-hidden="true"
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${step.done ? "text-muted line-through decoration-2" : ""}`}>
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </span>
                {!step.done && <span className="block text-sm text-muted">{step.detail}</span>}
              </span>
              {!step.done &&
                (step.key === "share" && studio.slug ? (
                  <CopyStudioLink url={`${siteUrl}/studio/${studio.slug}`} />
                ) : (
                  <Link href={step.href} className="group flex shrink-0 items-center gap-1 text-sm font-bold text-brand hover:underline">
                    Start <ArrowRightIcon size={16} className="transition group-hover:translate-x-1" />
                  </Link>
                ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
