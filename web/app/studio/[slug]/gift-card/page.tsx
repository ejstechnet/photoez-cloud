import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { localDateOf } from "@/lib/booking/time";
import { paymentAccount } from "@/lib/payments/checkout";
import { signedViewUrl } from "@/lib/storage";
import { StudioFooter } from "../studio-bar";
import { StudioNav } from "../studio-nav";
import { studioLinks } from "@/lib/studio-links";
import { GiftCardForm } from "./gift-card-form";

async function findStudio(slug: string) {
  const [studio] = await db.select().from(photographers).where(eq(photographers.studioSlug, slug.toLowerCase()));
  return studio ?? null;
}

export async function generateMetadata({ params }: PageProps<"/studio/[slug]/gift-card">): Promise<Metadata> {
  const studio = await findStudio((await params).slug);
  return { title: studio ? `Gift cards · ${studio.businessName || studio.name}` : "Studio not found · PhotoEZ Cloud" };
}

// A studio's gift card shop: buy a card for someone, paid through Stripe on
// the photographer's own account.
export default async function GiftCardPage({ params, searchParams }: PageProps<"/studio/[slug]/gift-card">) {
  const slug = (await params).slug.toLowerCase();
  const { bought, payment } = await searchParams;
  const studio = await findStudio(slug);
  if (!studio) notFound();
  const name = studio.businessName || studio.name;
  const logoUrl = studio.studioLogoKey ? await signedViewUrl(studio.studioLogoKey) : null;
  const open = studio.giftCardsEnabled && (await paymentAccount(studio.id)) !== null;

  return (
    <div className="flex flex-1 flex-col">
      <StudioNav
        slug={slug}
        name={name}
        logoUrl={logoUrl}
        logoBg={studio.studioLogoBg}
        links={(await studioLinks(slug)).filter((link) => link.label !== "Gift cards")}
      >
        <Link
          href={`/studio/${slug}/book`}
          className="ml-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider whitespace-nowrap text-on-accent uppercase transition hover:-translate-y-0.5"
        >
          Book a session
        </Link>
      </StudioNav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <div className="card overflow-hidden">
          <div className="relative overflow-hidden bg-brand-deep px-6 py-10 text-white sm:px-10">
            <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-lime/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 size-56 rounded-full bg-coral/25 blur-3xl" />
            <p className="relative text-sm font-bold tracking-wider text-sky-light uppercase">{name}</p>
            <h1 className="relative mt-2 font-display text-4xl font-bold sm:text-5xl">Give the gift of photos 🎁</h1>
            <p className="relative mt-3 max-w-lg text-white/80">
              A gift card for a photo session, emailed to them right away or on the day you choose.
            </p>
          </div>
          <div className="p-6 sm:p-10">
            {bought === "1" ? (
              <div className="text-center">
                <p className="text-5xl">💝</p>
                <h2 className="mt-4 font-display text-3xl font-bold">Thank you!</h2>
                <p className="mt-3 text-muted">
                  Your gift card is on its way, and your receipt (with the gift card code) is in your inbox.
                </p>
                <Link href={`/studio/${slug}`} className="btn-primary mt-6">
                  Back to {name}
                </Link>
              </div>
            ) : open ? (
              <>
                {payment === "cancelled" && (
                  <p className="mb-6 rounded-xl bg-sun/30 px-4 py-3 text-sm font-medium">
                    Payment was cancelled, so no gift card was made. You can try again below.
                  </p>
                )}
                <GiftCardForm
                  slug={slug}
                  amounts={studio.giftCardAmounts}
                  minCents={studio.giftCardMinCents}
                  maxCents={studio.giftCardMaxCents}
                  today={localDateOf(new Date(), studio.timeZone)}
                />
              </>
            ) : (
              <p className="text-center text-muted">Gift cards aren&apos;t available right now. Please contact the studio.</p>
            )}
          </div>
        </div>
      </main>
      <StudioFooter />
    </div>
  );
}
