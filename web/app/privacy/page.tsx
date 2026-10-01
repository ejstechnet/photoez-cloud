import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · PhotoEZ Cloud",
  description: "How PhotoEZ Cloud collects, uses, and protects information for photographers and their clients.",
};

const mail = <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

// The Privacy Policy. Written to match what the app actually stores and
// which services it uses; update both together (and LEGAL.updated).
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {LEGAL.service} ({LEGAL.site}) is studio software for photographers, run by {LEGAL.company} (&ldquo;we,&rdquo;
        &ldquo;us&rdquo;). This policy explains what information we collect, how we use it, who we share it with, and the
        choices you have. It covers photographers who use {LEGAL.service} (&ldquo;studios&rdquo;) and their clients who
        visit studio pages, book sessions, view galleries, or order prints and products.
      </p>

      <h2>Two kinds of users</h2>
      <p>
        <strong>Studios</strong> have accounts with us. <strong>Clients</strong> deal with a studio through pages we host
        for it. When a client gives information to a studio (an inquiry, a booking, a contract signature, a gallery
        selection, an order), the studio decides how that information is used, and we store and process it on the
        studio&rsquo;s behalf. If you&rsquo;re a client with a question about your information, you can contact the studio
        directly or contact us at {mail}.
      </p>

      <h2>What we collect</h2>
      <h3>From studios</h3>
      <ul>
        <li>Account details: your name, business name, email address, and password (stored only as a secure hash).</li>
        <li>Studio profile and settings: your studio page, logo, photos, bio, FAQs, session types, prices, and booking setup.</li>
        <li>Your photos and galleries, contracts, coupons, gift cards, and the records you keep about your clients.</li>
        <li>
          Billing: your plan and subscription status. Card details are entered on Stripe&rsquo;s pages and handled by
          Stripe; we never see or store full card numbers.
        </li>
      </ul>
      <h3>From clients (on a studio&rsquo;s behalf)</h3>
      <ul>
        <li>Contact details you enter: name, email address, and phone number.</li>
        <li>Inquiry messages, booking details, answers to a studio&rsquo;s booking questions, and inspiration photos you upload.</li>
        <li>
          Contract signatures: your typed or drawn signature, the time you signed, and your IP address and browser type,
          kept as a record of the signature.
        </li>
        <li>Gallery activity: favorites, notes, selections, and downloads.</li>
        <li>Store orders: what you ordered, your designs and uploaded files, and your shipping address.</li>
        <li>Reviews you write for a studio.</li>
      </ul>
      <h3>Automatically</h3>
      <ul>
        <li>
          Basic technical information such as IP address and browser type, used to keep the service secure, prevent
          abuse, and fix problems.
        </li>
        <li>Cookies, described below.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To run the service: studio pages, bookings, contracts, galleries, payments, delivery, and orders.</li>
        <li>To send emails the service needs: confirmations, reminders, gallery and order notices, and account messages.</li>
        <li>
          For AI features a studio turns on, such as sorting inquiries, describing photos so a gallery can be searched, and
          the Studio Assistant (see &ldquo;AI features&rdquo;).
        </li>
        <li>To keep accounts and payments secure and to prevent fraud and abuse.</li>
        <li>To support studios and improve {LEGAL.service}.</li>
      </ul>
      <p>
        We don&rsquo;t sell personal information, and we don&rsquo;t share it for advertising. We don&rsquo;t show ads in
        {" "}{LEGAL.service}.
      </p>

      <h2>AI features</h2>
      <p>
        Some features send text or photos to Anthropic&rsquo;s Claude service to be processed: inquiry messages (to sort
        them and draft replies), gallery photos (to describe them for search), and the studio&rsquo;s questions to the
        Studio Assistant. Anthropic processes this to return a result and does not use it to train its models. AI culling
        (flagging blurry or closed-eye photos) runs in your own browser, and those photos aren&rsquo;t sent anywhere for it.
      </p>

      <h2>Who we share information with</h2>
      <p>We share information only as needed to run the service, with these providers:</p>
      <ul>
        <li><strong>Stripe</strong>: payments for studios&rsquo; plans and for client payments to studios.</li>
        <li><strong>Cloudflare</strong> (R2 storage): photos and files, stored privately.</li>
        <li><strong>Anthropic</strong>: the AI features described above.</li>
        <li><strong>Our hosting provider</strong>: the servers that run {LEGAL.service} and send its email.</li>
        <li>
          <strong>Print and product partners</strong>, such as SwaggPress Creations: when a client orders from a studio&rsquo;s
          store, the photos or designs, product choices, and shipping address are sent to the partner to make and ship the order.
        </li>
        <li><strong>Google Fonts</strong>: studio pages may load fonts from Google, which receives your IP address.</li>
      </ul>
      <p>
        We may also share information if the law requires it, to protect the rights and safety of our users or others, or
        as part of a sale or transfer of the business (with this policy continuing to apply).
      </p>

      <h2>Cookies</h2>
      <p>We use only a small number of cookies, all needed for the service to work:</p>
      <ul>
        <li>A login cookie that keeps studios signed in.</li>
        <li>A referral cookie, set when someone follows a referral link, so the referral can be credited (kept 60 days).</li>
        <li>Stripe&rsquo;s cookies on payment pages, which help prevent fraud.</li>
      </ul>
      <p>
        We don&rsquo;t use advertising or tracking cookies. Your browser may also store a few settings for convenience
        (for example, items in a cart). If we ever add analytics or advertising tools, we&rsquo;ll update this policy and
        ask for your consent where the law requires it.
      </p>

      <h2>How long we keep information</h2>
      <p>
        Studio information is kept while the account is open. A studio can delete galleries, photos, clients, and other
        records at any time. When an account is closed, we delete its information within 90 days, except what we must keep
        for legal, tax, or payment records. Database backups are kept for up to 30 days.
      </p>

      <h2>Security</h2>
      <p>
        Connections to {LEGAL.service} are encrypted (HTTPS). Passwords are stored as secure hashes, photos are stored
        privately and shared through links that expire, payment details are handled by Stripe, and access to our systems
        is restricted. No system is perfectly secure, but we work to protect your information and will notify affected
        users of a breach as the law requires.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Studios can view and update their information in the dashboard, and close their account by contacting us.</li>
        <li>
          Anyone can ask us to access, correct, or delete their personal information, or ask questions about it, by emailing
          {" "}{mail}. For information a studio holds about you, we may refer your request to that studio, since it decides
          how that information is used.
        </li>
        <li>
          Depending on where you live (for example, California or the European Union), you may have additional rights. We
          honor those requests and won&rsquo;t treat you differently for making them.
        </li>
        <li>You can opt out of non-essential emails using the link in them.</li>
      </ul>

      <h2>Children</h2>
      <p>
        {LEGAL.service} is meant for businesses and isn&rsquo;t directed to children under 13. Photos of children may
        appear in galleries that studios deliver to their parents or guardians; those galleries are private to the studio
        and its client.
      </p>

      <h2>Changes</h2>
      <p>
        We&rsquo;ll post any changes here and update the date above. If a change is significant, we&rsquo;ll let studios
        know by email or in the dashboard.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.company}, {LEGAL.state}, USA · {mail}. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
