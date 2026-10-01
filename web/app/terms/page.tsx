import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalPage } from "@/components/legal-page";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Terms of Service · PhotoEZ Cloud",
  description: "The terms for using PhotoEZ Cloud, studio software for photographers.",
};

const mail = <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

// The Terms of Service. Update LEGAL.updated (components/legal-page.tsx) with any change.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {LEGAL.company} (&ldquo;we,&rdquo; &ldquo;us&rdquo;) for using{" "}
        {LEGAL.service} at {LEGAL.site} (the &ldquo;Service&rdquo;). By creating an account or using the Service, you
        agree to them. If you use the Service for a business, you agree on behalf of that business.
      </p>

      <h2>1. The Service</h2>
      <p>
        {LEGAL.service} gives photographers (&ldquo;studios&rdquo;) tools to run their business: a studio page, inquiries,
        booking, contracts, payments, client galleries and delivery, a print and product store, and AI features. Clients of
        a studio use the Service through the pages we host for that studio; studios are responsible for their own
        relationships with their clients.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18 and give accurate information when you sign up.</li>
        <li>Keep your password private. You&rsquo;re responsible for what happens under your account.</li>
        <li>Tell us right away at {mail} if you think someone else has accessed your account.</li>
      </ul>

      <h2>3. Plans, trials, and billing</h2>
      <ul>
        <li>
          New studios get a free {TRIAL_DAYS}-day Pro trial with no card required. When it ends, the account moves to the
          Free plan unless you choose a paid plan.
        </li>
        <li>
          Paid plans are billed in advance, monthly or yearly, through Stripe, and renew automatically until cancelled.
          You can change or cancel any time from Billing in your dashboard. Cancelling keeps your plan until the end of
          the period you&rsquo;ve paid for; we don&rsquo;t give refunds for partial periods unless the law requires it.
        </li>
        <li>
          Prices are shown on our <Link href="/pricing">pricing page</Link>. If we change the price of your plan, we&rsquo;ll
          tell you at least 30 days before it applies to your next renewal.
        </li>
        <li>Plans have limits (for example storage, active galleries, and AI use), shown on the pricing page.</li>
      </ul>

      <h2>4. Payments from your clients</h2>
      <p>
        Client payments (deposits, balances, extras, gift cards, and store orders) go to your own Stripe account, and
        Stripe&rsquo;s terms apply to them. {LEGAL.service} takes no commission. You&rsquo;re responsible for your prices,
        taxes, refunds, chargebacks, and the services you provide to your clients.
      </p>

      <h2>5. Store orders and print partners</h2>
      <p>
        If you sell products made by a print partner such as SwaggPress Creations, the partner makes and ships those
        orders, and its own terms and policies apply to them. You set your prices and are responsible to your clients for
        those sales; any amount the partner charges you is billed as described when you connect the partner.
      </p>

      <h2>6. Your content</h2>
      <p>
        You keep all rights to your photos, designs, contracts, and other content (&ldquo;your content&rdquo;). You give us
        permission to store, copy, process, and display your content only as needed to run the Service for you (for
        example, making proofs and previews, delivering galleries, and sending orders to print partners). You confirm that
        you have the rights and permissions needed for your content, including permission from the people in your photos
        where required.
      </p>

      <h2>7. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>upload or share anything illegal, infringing, or that exploits minors;</li>
        <li>send spam or messages people didn&rsquo;t ask for;</li>
        <li>break the law or anyone&rsquo;s rights, including privacy and intellectual-property rights;</li>
        <li>try to access other accounts or data, or disrupt, overload, or probe the Service; or</li>
        <li>copy, resell, or reverse-engineer the Service.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>8. AI features</h2>
      <p>
        AI features (such as inquiry sorting, drafted replies, photo search, culling help, and the Studio Assistant) can
        make mistakes. Review AI suggestions before relying on them; you&rsquo;re responsible for what you send to your
        clients. The Studio Assistant only takes actions after you approve them.
      </p>

      <h2>9. Privacy</h2>
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> explains how we handle information. You&rsquo;re responsible for
        having a lawful basis to collect your clients&rsquo; information and for telling them how you use it.
      </p>

      <h2>10. Ending your account</h2>
      <p>
        You can stop using the Service and ask us to close your account at any time. We may suspend or close accounts that
        break these terms or put the Service or others at risk, and we&rsquo;ll give notice where we reasonably can. After
        closing, download anything you want to keep; we delete account data as described in the Privacy Policy.
      </p>

      <h2>11. Availability and changes</h2>
      <p>
        We work to keep the Service running and your data safe, but we can&rsquo;t promise it will always be available or
        error-free, and we may change or end features. Keep your own copies of important files, such as your original photos.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, to the
        fullest extent the law allows, including warranties of merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, {LEGAL.company} won&rsquo;t be liable for indirect, incidental, special,
        consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our total liability for any
        claim related to the Service is limited to the amount you paid us in the 12 months before the claim, or $100 if
        you haven&rsquo;t paid us.
      </p>

      <h2>14. Indemnity</h2>
      <p>
        You agree to defend and hold {LEGAL.company} harmless from claims arising from your content, your use of the
        Service, your dealings with your clients, or your breaking these terms.
      </p>

      <h2>15. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of {LEGAL.state}, USA, without regard to its conflict-of-law
        rules. Any dispute will be handled in the state or federal courts located in {LEGAL.state}, and you and we agree
        to those courts&rsquo; jurisdiction.
      </p>

      <h2>16. Changes to these terms</h2>
      <p>
        We may update these terms. We&rsquo;ll post changes here and update the date above, and tell studios about
        significant changes by email or in the dashboard. Continuing to use the Service after a change means you accept it.
      </p>

      <h2>17. Contact</h2>
      <p>
        {LEGAL.company}, {LEGAL.state}, USA · {mail}
      </p>
    </LegalPage>
  );
}
