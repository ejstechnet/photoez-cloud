import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { LEGAL } from "@/components/legal-page";
import { formatPhone } from "@/lib/sms/phone";
import { signedViewUrl } from "@/lib/storage";
import { studioLinks } from "@/lib/studio-links";
import { StudioFooter } from "../studio-bar";
import { StudioNav } from "../studio-nav";

async function findStudio(slug: string) {
  const [studio] = await db.select().from(photographers).where(eq(photographers.studioSlug, slug.toLowerCase()));
  return studio ?? null;
}

export async function generateMetadata({ params }: PageProps<"/studio/[slug]/privacy">): Promise<Metadata> {
  const studio = await findStudio((await params).slug);
  return { title: studio ? `Privacy & text messages · ${studio.businessName || studio.name}` : "Studio not found · PhotoEZ Cloud" };
}

// Each studio's own privacy and text message policy, on its studio site. US
// carriers review this page when a studio registers its texting (A2P 10DLC):
// it must say what texts are sent, how people opt in and out, that rates may
// apply, and that phone numbers and consent are never shared or sold.
export default async function StudioPrivacyPage({ params }: PageProps<"/studio/[slug]/privacy">) {
  const slug = (await params).slug.toLowerCase();
  const studio = await findStudio(slug);
  if (!studio) notFound();
  const name = studio.businessName || studio.name;
  const contact = studio.notifyEmail || studio.email;
  const number = studio.smsFrom?.startsWith("+") ? formatPhone(studio.smsFrom) : null;
  const logoUrl = studio.studioLogoKey ? await signedViewUrl(studio.studioLogoKey) : null;
  const mail = <a href={`mailto:${contact}`}>{contact}</a>;

  return (
    <div className="flex flex-1 flex-col">
      <StudioNav slug={slug} name={name} logoUrl={logoUrl} logoBg={studio.studioLogoBg} links={await studioLinks(slug)} />
      <main className="legal mx-auto w-full max-w-3xl flex-1 px-4 py-12 leading-relaxed">
        <h1 className="font-display text-4xl font-bold tracking-tight">Privacy &amp; text message policy</h1>
        <p className="mt-2 text-muted">{name}</p>

        <h2>What we collect</h2>
        <p>
          When you contact {name}, book a session, sign a contract, view a gallery, or place an order, we collect what you
          give us: your name, email address, phone number, session details, and any notes, answers, or photos you share.
          Payments are handled by Stripe; we never see or store your full card number.
        </p>

        <h2>How we use it</h2>
        <p>
          Only to provide our photography services to you: to schedule and remind you about your session, send your contract,
          invoices, and receipts, deliver your photos, and answer your questions.
        </p>

        <h2>Text messages (SMS)</h2>
        <p>
          <strong>{name} text reminders.</strong> If you check &ldquo;Text me reminders&rdquo; when you book, sign up on our{" "}
          <Link href={`/studio/${slug}/texts`}>text reminders page</Link>, or tell us you&rsquo;d like texts, we&rsquo;ll text you about your own session and photos
          {number ? <> from {number}</> : null}: session reminders, payment reminders and links, and messages that your
          gallery is ready or closing soon. We don&rsquo;t send marketing texts. Checking the box is never required to book.
        </p>
        <ul>
          <li>Message frequency varies, usually a few messages per session.</li>
          <li>Message and data rates may apply.</li>
          <li>
            Reply <strong>STOP</strong> at any time to stop texts. You&rsquo;ll get one message confirming you&rsquo;ve opted
            out. Reply <strong>START</strong> to opt back in.
          </li>
          <li>
            Reply <strong>HELP</strong> for help, or contact us at {mail}.
          </li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
        </ul>
        <p>
          <strong>
            We do not sell, rent, or share your mobile phone number or your text message consent with third parties or
            affiliates for marketing or promotional purposes.
          </strong>{" "}
          No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All
          the categories above exclude text messaging originator opt-in data and consent; this information will not be
          shared with any third parties.
        </p>

        <h2>Who else sees your information</h2>
        <p>
          We use {LEGAL.service} to run our bookings, galleries, and payments, which stores your information securely on our
          behalf. Our service providers (payment processing, photo storage, email and text delivery) receive only what they
          need to do their job. We never sell your personal information.
        </p>

        <h2>Your choices</h2>
        <p>
          You can ask us to see, correct, or delete your information at any time by emailing {mail}. You can stop text
          messages by replying STOP.
        </p>

        <h2>Contact</h2>
        <p>
          {name} · {mail}
          {number ? <> · {number}</> : null}
        </p>
        <p className="text-sm text-muted">
          See also the <Link href="/privacy">{LEGAL.service} Privacy Policy</Link>.
        </p>
      </main>
      <StudioFooter studioId={studio.id} />
    </div>
  );
}
