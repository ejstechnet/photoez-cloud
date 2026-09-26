import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers, studioFaqs } from "@/db/schema";
import { SUGGESTED_FAQ_QUESTIONS } from "@/lib/faq";
import { requirePhotographer } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { richTextHtml } from "@/lib/rich-text";
import { signedViewUrl } from "@/lib/storage";
import { syncStripeStatus } from "@/lib/payments/connect";
import { stripeConfigured } from "@/lib/stripe";
import { FaqForm } from "./faq-form";
import { PaymentsCard } from "./payments-card";
import { NotesToggle } from "./notes-toggle";
import { PlanCard } from "./plan-card";
import { PLAN_LABELS, planFor } from "@/lib/plans";
import { studioPlan } from "@/lib/studio-plan";
import { StudioForm } from "./studio-form";
import { StudioLogo } from "./studio-logo";
import { WatermarkForm } from "./watermark-form";

export default async function SettingsPage() {
  const user = await requirePhotographer();
  const [settings] = await db
    .select({
      key: photographers.watermarkKey,
      opacity: photographers.watermarkOpacity,
      position: photographers.watermarkPosition,
      businessName: photographers.businessName,
      studioSlug: photographers.studioSlug,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
      studioTagline: photographers.studioTagline,
      studioBio: photographers.studioBio,
      serviceArea: photographers.serviceArea,
      offeredTypes: photographers.offeredTypes,
      shootLocations: photographers.shootLocations,
      quoteOnlyTypes: photographers.quoteOnlyTypes,
      stripeAccountId: photographers.stripeAccountId,
      stripeReady: photographers.stripeChargesEnabled,
      photoNotesEnabled: photographers.photoNotesEnabled,
    })
    .from(photographers)
    .where(eq(photographers.id, user.id));

  const faqs = await db
    .select({ question: studioFaqs.question, answer: studioFaqs.answer })
    .from(studioFaqs)
    .where(eq(studioFaqs.photographerId, user.id))
    .orderBy(asc(studioFaqs.sortOrder));
  const askedAlready = new Set(faqs.map((faq) => faq.question.trim().toLowerCase()));
  const suggestions = SUGGESTED_FAQ_QUESTIONS.filter((q) => !askedAlready.has(q.toLowerCase()));

  const plan = await studioPlan(user.id);
  // Still waiting on Stripe's approval? Ask Stripe now instead of relying on its webhook.
  let stripeReady = settings.stripeReady;
  if (!stripeReady && settings.stripeAccountId && stripeConfigured()) {
    stripeReady = await syncStripeStatus(user.id, settings.stripeAccountId).catch(() => false);
  }

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-sky uppercase">Studio settings</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Settings</h1>

      {/* Two columns on wide screens, like PhotoEZ for WordPress; one column on phones. */}
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <section id="studio" className="card scroll-mt-8 p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">Studio profile</h2>
            <p className="mt-1 text-sm text-muted">
              Your public studio page, where clients send inquiries and quote requests that land in Inquiries, already
              triaged.
            </p>
            <div className="mt-6">
              <StudioLogo
                currentUrl={settings.logoKey ? await signedViewUrl(settings.logoKey) : null}
                background={settings.logoBg}
              />
            </div>
            <div className="mt-6 border-t border-border pt-6">
              <StudioForm
                siteUrl={siteUrl}
                profile={{
                  businessName: settings.businessName ?? user.name,
                  studioSlug: settings.studioSlug ?? "",
                  studioTagline: settings.studioTagline ?? "",
                  studioBio: richTextHtml(settings.studioBio),
                  serviceArea: settings.serviceArea ?? "",
                  offeredTypes: settings.offeredTypes,
                  shootLocations: settings.shootLocations,
                  quoteOnlyTypes: settings.quoteOnlyTypes,
                }}
              />
            </div>
          </section>

          <section className="card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">Proofing</h2>
            <p className="mt-1 text-sm text-muted">
              Your watermark is stamped on every proof clients see while they choose favorites. Final downloads are
              always clean.
            </p>
            <div className="mt-6">
              <WatermarkForm
                currentUrl={settings.key ? await signedViewUrl(settings.key) : null}
                opacity={settings.opacity}
                position={settings.position}
              />
            <NotesToggle enabled={settings.photoNotesEnabled} />
            </div>
          </section>
        </div>
        <div className="space-y-8">
          <PaymentsCard configured={stripeConfigured()} accountId={settings.stripeAccountId} ready={stripeReady} />
          <PlanCard
            planLabel={PLAN_LABELS[plan.plan]}
            upsells={plan.upsells}
            upgradePlanLabel={PLAN_LABELS[planFor("galleryUpsells")]}
            extraPhotoPriceCents={plan.extraPhotoPriceCents}
          />
          <section id="faq" className="card scroll-mt-8 p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">Client FAQ</h2>
            <p className="mt-1 text-sm text-muted">
              Answer once, and clients find it themselves: your answers appear on your studio page, and the AI uses them to
              reply to inquiries without you. Skip any question by leaving it blank.
            </p>
            <div className="mt-6">
              <FaqForm saved={faqs} suggestions={suggestions} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
