import Link from "next/link";
import { AI_ASSISTANT_ALLOWANCE, AI_PHOTO_ALLOWANCE, PLAN_LIMITS, PLAN_PRICES, TRIAL_DAYS, formatStorage } from "@/lib/plans";
import type { ArticleMeta } from "./index";

// The first photoezcloud.com article: what PhotoEZ Cloud is, by feature,
// with the plans. Numbers come from lib/plans.ts so they never go stale.

export const introducingPhotoezCloud: ArticleMeta = {
  slug: "introducing-photoez-cloud",
  title: "Introducing PhotoEZ Cloud: One Place to Run Your Photography Business",
  description:
    "PhotoEZ Cloud puts booking, contracts, proofing galleries, invoices with payment plans, a print store, text reminders, and AI help in one app for photographers, with no commission on your sales.",
  published: "2026-10-03",
  category: "PhotoEZ Cloud",
  readMinutes: 7,
  image: {
    src: "/articles/photoezcloud-hero.webp",
    width: 1477,
    height: 766,
    alt: "The PhotoEZ Cloud home page: \"Studio software with a creative streak,\" beside a photographer with her camera and cards for a new inquiry, photos found, a gallery delivered, a client gallery, and a booking confirmed.",
    share: "/articles/photoezcloud-hero-share.jpg",
  },
};

const dollars = (cents: number) => `$${cents / 100}`;
const n = (value: number) => value.toLocaleString("en-US");

export function IntroducingPhotoezCloud() {
  return (
    <>
      <p className="text-lg">
        If you&rsquo;re a working photographer, you probably pay for a pile of separate apps: one for scheduling, one for
        contracts, one for galleries, one for invoices, maybe another for prints. Each has its own login, its own monthly
        bill, and its own copy of your client&rsquo;s name and email. PhotoEZ Cloud replaces that pile with one place that
        follows a client from their first inquiry to their final download.
      </p>
      <p>
        PhotoEZ Cloud is the hosted version of <a href="https://photoez.net">PhotoEZ</a>, the WordPress plugin suite I built
        after 17 years behind the camera. It keeps the same workflow, but you don&rsquo;t need a WordPress site, hosting, or
        updates. You sign up, set up your studio, and start booking.
      </p>

      <h2>Your studio page, and inquiries that sort themselves</h2>
      <p>
        Every studio gets a public page with your work, your sessions and prices, reviews, and FAQs, styled with the Page
        Designer to match your brand. Its inquiry form doesn&rsquo;t just land in your inbox: AI reads each message, pulls
        out the client&rsquo;s name, session type, and date, and drafts a reply. When a question is already answered on your
        page (like your prices or your booking link), it can send that reply for you, so you only step in when it needs a
        person.
      </p>
      <p>
        You can also list your studio in the <Link href="/photographers">PhotoEZ Cloud photographer directory</Link>, where
        clients search by ZIP code or city and type of shoot.
      </p>

      <h2>Step-by-step online booking</h2>
      <p>
        Clients book in a few clear steps: pick a session, a day, and an open time, then add extras and their details.
        Only times you&rsquo;re actually free are offered. You can take a deposit through your own Stripe account, offer
        coupon codes and gift cards, apply session credits, and let clients reschedule within the rules you set. Bookings
        can feed your Google, Apple, or Outlook calendar through a private calendar link.
      </p>

      <h2>Contracts, signed online</h2>
      <p>
        Write your contract once, with placeholders for the client&rsquo;s name, session, date, and amounts. Each booking
        fills them in automatically, and the client signs by drawing or typing, right after booking. The signed copy is
        saved with the date, time, and IP address, and either of you can print or save it as a PDF any time.
      </p>

      <h2>Proofing and delivery galleries</h2>
      <p>
        A confirmed booking can get its gallery automatically, or you can make one for any client. Clients pick favorites from watermarked proofs, leave notes
        on photos (&ldquo;can you soften this?&rdquo;), and can buy extra photos beyond their package. When you upload the
        edited finals, they download full-resolution, unwatermarked files one at a time or as a single ZIP.
      </p>
      <p>A few things make the gallery side faster:</p>
      <ul>
        <li>
          <strong>AI culling help</strong> flags blurry and closed-eye shots so you can clear them before clients see them.
          It runs in your browser, so it&rsquo;s unlimited on every plan.
        </li>
        <li>
          <strong>AI gallery search</strong> lets clients type &ldquo;grandma&rdquo; or &ldquo;the dog&rdquo; and find those
          photos.
        </li>
        <li>
          <strong>Slideshows with music</strong> (Pro and Studio) play a client&rsquo;s final photos full-screen, set to a
          song you upload for that gallery.
        </li>
      </ul>

      <h2>A print and product store in every gallery</h2>
      <p>
        Delivered galleries can include a shop. Clients order prints and products of their own photos, and design them in
        a built-in designer. You can fulfill orders yourself or send them to a print partner: SwaggPress Creations is the
        first, and its orders go straight to production with tracking sent back to the client.
      </p>

      <h2>Quotes and invoices with payment plans</h2>
      <p>
        For weddings and bigger jobs, send a quote the client approves online, then an invoice they pay by card. Choose
        payment in full, a deposit and the balance, or a payment plan of monthly or bi-weekly installments. Attach a
        contract to be signed before the first payment, and let PhotoEZ Cloud send the reminders: three days before each
        payment is due, and again if it&rsquo;s late. Cash or check? Record it, and the balance updates.
      </p>

      <h2>Email and text reminders</h2>
      <p>
        Session reminders, balance reminders, &ldquo;your photos are ready,&rdquo; and &ldquo;your gallery closes soon&rdquo;
        go out by email on their own. On Pro and Studio, they can go out by text too, through your own Twilio account, only
        to clients who opted in, with STOP handled for you.
      </p>

      <h2>Reviews, referrals, and your Studio Assistant</h2>
      <p>
        After delivery, PhotoEZ Cloud can ask clients for a review, which you approve before it shows on your page. Clients
        can share a referral link that gives a friend a discount and earns them a session credit. And the Studio Assistant
        answers questions about your business in plain English, like &ldquo;how much did I make in September?&rdquo; or
        &ldquo;find the Smith family&rsquo;s gallery.&rdquo;
      </p>

      <h2>Your money stays yours</h2>
      <p>
        Client payments go straight to your own Stripe account. PhotoEZ Cloud takes <strong>no commission</strong> on
        bookings, invoices, gallery extras, gift cards, or store sales; you pay only Stripe&rsquo;s normal processing fee.
      </p>

      <h2>Plans</h2>
      <ul>
        <li>
          <strong>Free</strong>: your studio page, booking, contracts, payments, {PLAN_LIMITS.free.activeGalleries} active
          galleries, {formatStorage(PLAN_LIMITS.free.storageBytes)} of storage, and a taste of the AI (
          {n(AI_PHOTO_ALLOWANCE.free)} photos searched and {n(AI_ASSISTANT_ALLOWANCE.free)} assistant questions a month).
        </li>
        <li>
          <strong>Pro</strong>, {dollars(PLAN_PRICES.pro.month)}/month or {dollars(PLAN_PRICES.pro.year)}/year: unlimited
          active galleries, {formatStorage(PLAN_LIMITS.pro.storageBytes)} of storage, paid extra photos, quotes and invoices
          with payment plans, slideshows, text reminders, and {n(AI_PHOTO_ALLOWANCE.pro)} AI photos /{" "}
          {n(AI_ASSISTANT_ALLOWANCE.pro)} questions a month.
        </li>
        <li>
          <strong>Studio</strong>, {dollars(PLAN_PRICES.studio.month)}/month or {dollars(PLAN_PRICES.studio.year)}/year:
          everything in Pro with {formatStorage(PLAN_LIMITS.studio.storageBytes)} of storage, {n(AI_PHOTO_ALLOWANCE.studio)}{" "}
          AI photos / {n(AI_ASSISTANT_ALLOWANCE.studio)} questions a month, and the option to remove &ldquo;Powered by PhotoEZ
          Cloud.&rdquo;
        </li>
      </ul>
      <p>
        Every new studio gets {TRIAL_DAYS} days of Pro free, with no card needed. See the full comparison on the{" "}
        <Link href="/pricing">pricing page</Link>.
      </p>

      <h2>Who it&rsquo;s for</h2>
      <p>
        PhotoEZ Cloud is built for portrait, family, newborn, senior, wedding, and event photographers who want their
        business in one place without becoming a web developer. If you already run a WordPress site and want everything on
        your own hosting, <a href="https://photoez.net">PhotoEZ for WordPress</a> is the same workflow as plugins.
      </p>

      <p className="mt-10">
        <Link href="/signup" className="btn-primary">
          Start your studio free
        </Link>
      </p>
      <p className="text-sm text-muted">Elle Jones, photographer and founder of PhotoEZ</p>
    </>
  );
}
