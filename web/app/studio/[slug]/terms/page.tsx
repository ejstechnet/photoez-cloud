import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { formatPhone } from "@/lib/sms/phone";
import { signedViewUrl } from "@/lib/storage";
import { studioLinks } from "@/lib/studio-links";
import { StudioFooter } from "../studio-bar";
import { StudioNav } from "../studio-nav";

async function findStudio(slug: string) {
  const [studio] = await db.select().from(photographers).where(eq(photographers.studioSlug, slug.toLowerCase()));
  return studio ?? null;
}

export async function generateMetadata({ params }: PageProps<"/studio/[slug]/terms">): Promise<Metadata> {
  const studio = await findStudio((await params).slug);
  return { title: studio ? `Terms and Conditions · ${studio.businessName || studio.name}` : "Studio not found · PhotoEZ Cloud" };
}

// Each studio's own Terms and Conditions for its clients: booking and
// payments, client obligations, photos, the text message program, liability,
// and disputes. Carriers review it (with /privacy) when a studio registers its
// texting (A2P 10DLC), and it names the studio's registered business.
// A session's own contract, when there is one, adds to these terms.
export default async function StudioTermsPage({ params }: PageProps<"/studio/[slug]/terms">) {
  const slug = (await params).slug.toLowerCase();
  const studio = await findStudio(slug);
  if (!studio) notFound();
  const name = studio.businessName || studio.name;
  const legal = studio.legalName?.trim() || null;
  const owner = legal && legal.toLowerCase() !== name.toLowerCase() ? legal : null;
  const who = owner ? `${owner}, doing business as ${name}` : name;
  const contact = studio.notifyEmail || studio.email;
  const number = studio.smsFrom?.startsWith("+") ? formatPhone(studio.smsFrom) : null;
  const state = studio.legalState ? (STATE_NAMES[studio.legalState] ?? studio.legalState) : null;
  const logoUrl = studio.studioLogoKey ? await signedViewUrl(studio.studioLogoKey) : null;
  const mail = <a href={`mailto:${contact}`}>{contact}</a>;

  return (
    <div className="flex flex-1 flex-col">
      <StudioNav slug={slug} name={name} logoUrl={logoUrl} logoBg={studio.studioLogoBg} links={await studioLinks(slug)} />
      <main className="legal mx-auto w-full max-w-3xl flex-1 px-4 py-12 leading-relaxed">
        <h1 className="font-display text-4xl font-bold tracking-tight">Terms and Conditions</h1>
        <p className="mt-2 text-muted">
          {name}
          {owner ? `, operated by ${owner}` : ""}
        </p>

        <p>
          These Terms and Conditions (&ldquo;Terms&rdquo;) are an agreement between you and {who} (&ldquo;we,&rdquo;
          &ldquo;us&rdquo;). They apply when you use our website and booking pages, book or pay for a photography session,
          sign up for text messages, view or download a photo gallery, or order prints and products. By doing any of these,
          you agree to these Terms and our <Link href={`/studio/${slug}/privacy`}>Privacy Policy</Link>.
        </p>

        <h2>1. Our services</h2>
        <p>
          We provide photography sessions and related services: booking, contracts, invoices, online galleries, photo
          delivery, and prints and products. Session details, prices, and what&rsquo;s included are shown when you book or
          on your quote or invoice. If you sign a contract for your session, the contract also applies, and it controls if
          it differs from these Terms.
        </p>

        <h2>2. Bookings and payments</h2>
        <ul>
          <li>A booking is confirmed when you complete it and pay any deposit required.</li>
          <li>Payments are processed securely by Stripe. Prices include any tax shown at checkout or on your invoice.</li>
          <li>
            Rescheduling, cancellations, deposits, and refunds follow the policy shown when you book and in your contract.
            Payment plans are due on the dates shown on your invoice.
          </li>
        </ul>

        <h2>3. Your responsibilities</h2>
        <ul>
          <li>Give accurate information, including a phone number that is yours if you sign up for texts.</li>
          <li>Arrive on time and follow reasonable safety instructions at your session.</li>
          <li>Keep your private booking, invoice, and gallery links to yourself and those you choose to share them with.</li>
          <li>Don&rsquo;t misuse our website, try to access other people&rsquo;s information, or interfere with our services.</li>
        </ul>

        <h2>4. Photos and use</h2>
        <p>
          We own the copyright in the photos we create. You receive a personal-use license to the photos delivered to you:
          you may print, share, and post them for personal, non-commercial use. Commercial use, editing that changes the
          photos&rsquo; character, or resale needs our written permission. We may use photos in our portfolio unless you ask
          us not to in writing.
        </p>

        <h2>5. Text messages (SMS)</h2>
        <p>
          <strong>Program:</strong> {name} text reminders{number ? `, sent from ${number}` : ""}.
        </p>
        <ul>
          <li>
            You may opt in by checking the &ldquo;Text me reminders&rdquo; box when booking, on our{" "}
            <Link href={`/studio/${slug}/texts`}>text reminders page</Link>, or by asking us. Opting in is never required to
            book or buy.
          </li>
          <li>
            We text about your own session and photos: session reminders, payment reminders with a payment link, and notices
            that your gallery is ready or closing soon. No marketing messages.
          </li>
          <li>Message frequency varies, usually a few messages per session. Message and data rates may apply.</li>
          <li>
            Reply <strong>STOP</strong> to cancel at any time; you&rsquo;ll get one confirmation and no more texts. Reply{" "}
            <strong>START</strong> to rejoin. Reply <strong>HELP</strong> for help, or email {mail}.
          </li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
          <li>
            We never sell or share your mobile number or text message consent with third parties for marketing. See our{" "}
            <Link href={`/studio/${slug}/privacy`}>Privacy Policy</Link>.
          </li>
        </ul>

        <h2>6. Limitation of liability</h2>
        <p>
          We take great care with every session and your photos. If something goes wrong because of us (for example, a
          session we can&rsquo;t complete, or photos lost through equipment failure), our total liability is limited to the
          amount you paid us for that session or order, and you may choose a reschedule or a refund of that amount. We are
          not liable for indirect or consequential losses, or for delays caused by events outside our reasonable control
          (such as weather, illness, or emergencies). Nothing in these Terms limits rights you have under the law that
          can&rsquo;t be limited.
        </p>

        <h2>7. Disputes</h2>
        <p>
          If you have a concern, please contact us first at {mail}; we&rsquo;ll work with you in good faith to resolve it
          within 30 days. If we can&rsquo;t resolve it informally, any dispute will be handled in the small claims or state
          courts {state ? `of ${state}` : "where our business is located"}, and these Terms are governed by the laws of{" "}
          {state ?? "that state"}.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these Terms. The current version is always on this page; changes don&rsquo;t affect a session already
          booked unless you agree.
        </p>

        <h2>9. Contact</h2>
        <p>
          {who} · {mail}
          {number ? <> · {number}</> : null}
        </p>
      </main>
      <StudioFooter studioId={studio.id} />
    </div>
  );
}

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "the District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
