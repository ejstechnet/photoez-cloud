import Link from "next/link";
import {
  AI_ASSISTANT_ALLOWANCE,
  AI_PHOTO_ALLOWANCE,
  PLAN_LIMITS,
  PLAN_PRICES,
  STORAGE_BLOCK_BYTES,
  STORAGE_BLOCK_PRICES,
  TRIAL_DAYS,
  formatStorage,
} from "@/lib/plans";
import type { ArticleMeta } from "./index";

// PhotoEZ Cloud next to Pixieset, for photographers searching for an
// alternative (Elle saw Pixieset users asking for one, 2026-10-20). Fair on
// purpose: every Pixieset fact comes from Pixieset's own pricing pages, read
// on 2026-10-20 (pixieset.com/pricing, /pricing-studio-manager,
// /pricing-suite), and where Pixieset is ahead, it says so. PhotoEZ Cloud's
// numbers come from lib/plans.ts so they never go stale. Re-check Pixieset's
// prices and bump `updated` when they change.

export const photoezCloudVsPixieset: ArticleMeta = {
  slug: "photoez-cloud-vs-pixieset",
  title: "PhotoEZ Cloud vs. Pixieset: An Honest Comparison for Photographers",
  description:
    "Looking for a Pixieset alternative? How PhotoEZ Cloud and Pixieset compare on price, booking, contracts, galleries, storage, AI, and selling, including where Pixieset is ahead.",
  published: "2026-10-20",
  category: "Comparisons",
  readMinutes: 8,
};

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const perMonthYearly = (cents: number) => `$${(cents / 100 / 12).toFixed(2).replace(/\.00$/, "")}`;
const n = (value: number) => value.toLocaleString("en-US");

// One row of the price table: a plan on each side that does a similar job.
function Row({ need, pixieset, photoez }: { need: string; pixieset: React.ReactNode; photoez: React.ReactNode }) {
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="py-3 pr-4 text-left font-semibold">
        {need}
      </th>
      <td className="py-3 pr-4">{pixieset}</td>
      <td className="py-3">{photoez}</td>
    </tr>
  );
}

export function PhotoezCloudVsPixieset() {
  const pro = PLAN_PRICES.pro;
  const studio = PLAN_PRICES.studio;
  return (
    <>
      <p className="text-lg">
        Pixieset is one of the best-known names in photography software, and for good reason: its galleries are beautiful
        and it&rsquo;s easy to start. But more and more photographers are asking for an alternative, usually because of
        price, because booking and contracts cost extra, or because they want one app instead of several. This is an
        honest look at how PhotoEZ Cloud compares, including the places where Pixieset is still ahead.
      </p>
      <p>
        A note on who&rsquo;s writing: I&rsquo;m a photographer, and I built PhotoEZ Cloud. I&rsquo;ve tried to be fair.
        Every Pixieset price and limit below comes from Pixieset&rsquo;s own pricing pages as of October 2026, and you
        should check{" "}
        <a href="https://pixieset.com/pricing/" target="_blank" rel="noopener">
          their current prices
        </a>{" "}
        before you decide.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>Choose Pixieset</strong> if you want a full website builder, a branded mobile gallery app, video
          delivery, RAW uploads, email marketing campaigns, or a print store with automatic lab fulfillment today.
        </li>
        <li>
          <strong>Choose PhotoEZ Cloud</strong> if you want booking, contracts, proofing galleries, invoices with payment
          plans, and AI help in one app and one plan, with no limits on sessions or contracts and no commission on your
          sales.
        </li>
      </ul>

      <h2>How they&rsquo;re put together</h2>
      <p>
        Pixieset is a family of separate apps, each with its own plans: <strong>Client Gallery</strong> (galleries and
        the store), <strong>Studio Manager</strong> (booking, contracts, invoices), and <strong>Website</strong>. You can
        buy them one at a time or together as the <strong>Pixieset Suite</strong>.
      </p>
      <p>
        PhotoEZ Cloud is one app. Your studio page, booking, contracts, proofing galleries, delivery, invoices, reminders,
        and AI features all share the same clients and the same login, on one plan.
      </p>

      <h2>Price, side by side</h2>
      <p>
        Here are the plans that do a similar job. Prices are per month: billed yearly first, then month to month.
      </p>
      <div className="not-prose overflow-x-auto rounded-2xl border border-border bg-surface px-4">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wider text-muted uppercase">
              <th scope="col" className="py-3 pr-4">
                What you need
              </th>
              <th scope="col" className="py-3 pr-4">
                Pixieset
              </th>
              <th scope="col" className="py-3">
                PhotoEZ Cloud
              </th>
            </tr>
          </thead>
          <tbody>
            <Row
              need="Free"
              pixieset={
                <>
                  Client Gallery Free: 3 GB, 15% commission on store sales. Studio Manager Free: 1 session type, 3
                  contracts.
                </>
              }
              photoez={
                <>
                  Free: {formatStorage(PLAN_LIMITS.free.storageBytes)}, {PLAN_LIMITS.free.activeGalleries} active
                  galleries, booking, contracts and proofing included, no commission.
                </>
              }
            />
            <Row
              need="Galleries + booking + contracts"
              pixieset={<>Suite Starter: $28 yearly or $35 monthly. 100 GB, 3 session types.</>}
              photoez={
                <>
                  Pro: {perMonthYearly(pro.year)} yearly ({dollars(pro.year)}/year) or {dollars(pro.month)} monthly.{" "}
                  {formatStorage(PLAN_LIMITS.pro.storageBytes)}, unlimited sessions.
                </>
              }
            />
            <Row
              need="Lots of storage"
              pixieset={<>Suite Pro: $38 yearly or $50 monthly. 2,000 GB.</>}
              photoez={
                <>
                  Studio: {perMonthYearly(studio.year)} yearly ({dollars(studio.year)}/year) or {dollars(studio.month)}{" "}
                  monthly. {formatStorage(PLAN_LIMITS.studio.storageBytes)}.
                </>
              }
            />
            <Row
              need="Galleries only"
              pixieset={<>Client Gallery Basic $8 to Ultimate $40 yearly ($10 to $50 monthly), 10 GB to unlimited.</>}
              photoez={<>No galleries-only plan: every plan includes booking and contracts too.</>}
            />
          </tbody>
        </table>
      </div>
      <p>
        At the mid level, PhotoEZ Cloud Pro costs a little less than Pixieset&rsquo;s Suite Starter, with more storage
        and unlimited session types. With lots of storage, Pixieset&rsquo;s Suite Pro is a little cheaper billed
        yearly, and PhotoEZ Cloud Studio is a little cheaper month to month. On PhotoEZ Cloud Pro and Studio you can add
        storage in {formatStorage(STORAGE_BLOCK_BYTES)} blocks for {dollars(STORAGE_BLOCK_PRICES.month)} a month each.
      </p>

      <h2>Booking, contracts, and invoices</h2>
      <p>
        This is the biggest difference. In Pixieset, booking and contracts live in Studio Manager, and its plans set
        limits: the free plan allows one session type and three contracts, and the Plus plan ($12 yearly or $15 monthly)
        allows three session types. Unlimited session types start at Studio Manager Pro or Suite Pro.
      </p>
      <p>
        PhotoEZ Cloud has no limits on session types, bookings, or contracts on any plan, including Free. Clients book in a
        few steps from your real open times, pay a deposit through your own Stripe account, and sign your contract online
        right after booking. On Pro and Studio you also get quotes and invoices with payment plans (a deposit and monthly
        or bi-weekly installments), with automatic reminders before each payment is due.
      </p>

      <h2>Galleries and delivery</h2>
      <p>
        Both give clients a polished gallery to pick favorites from and download their photos, and both let you
        watermark proofs. Pixieset is ahead on media: it handles video and RAW files and offers a branded mobile gallery
        app, which PhotoEZ Cloud doesn&rsquo;t.
      </p>
      <p>
        PhotoEZ Cloud&rsquo;s galleries are built around proofing: clients choose their included photos from watermarked
        proofs, leave notes on the ones they want touched up, and can pay for extra photos beyond their package (Pro and
        up). Then you upload the edited finals for clean, full-resolution download. Pro and Studio add slideshows set to
        a song you choose.
      </p>

      <h2>AI that saves you time</h2>
      <p>PhotoEZ Cloud puts AI to work on the busywork, on every plan:</p>
      <ul>
        <li>
          <strong>Inquiry help:</strong> each new inquiry is read and sorted, with the client&rsquo;s session type and
          date pulled out and a reply drafted for you to send.
        </li>
        <li>
          <strong>Culling help:</strong> flags blurry frames, closed eyes, missed flashes, and near-duplicates before your
          client sees them. It runs in your browser, so it&rsquo;s unlimited on every plan.
        </li>
        <li>
          <strong>Gallery search:</strong> clients type &ldquo;grandma&rdquo; or &ldquo;the dog&rdquo; and find those
          photos ({n(AI_PHOTO_ALLOWANCE.pro)} photos a month on Pro, {n(AI_PHOTO_ALLOWANCE.studio)} on Studio).
        </li>
        <li>
          <strong>Studio Assistant:</strong> ask about your business in plain English, like &ldquo;which galleries
          expire this week?&rdquo; ({n(AI_ASSISTANT_ALLOWANCE.pro)} questions a month on Pro).
        </li>
      </ul>
      <p>
        Pixieset offers culling and editing through its Photo Editor, a separate add-on at $12 a month.
      </p>

      <h2>Selling to your clients</h2>
      <p>
        Pixieset&rsquo;s store is a real strength: prints and products sell right from the gallery, with automatic lab
        fulfillment. Its free gallery plan takes a 15% commission on store sales; its paid plans are commission-free.
      </p>
      <p>
        PhotoEZ Cloud never takes a commission on any plan. Client payments go straight to your own Stripe account (you
        pay only Stripe&rsquo;s standard processing fee). Today you can sell extra photos, sessions, and gift cards. A
        print and merch store with our partner SwaggPress Creations is coming soon.
      </p>

      <h2>Where Pixieset is ahead</h2>
      <p>To be straight with you, Pixieset is the better pick if you need any of these right now:</p>
      <ul>
        <li>A full website builder (PhotoEZ Cloud gives you a studio page with your work, sessions, reviews and booking, not a whole website)</li>
        <li>A branded mobile gallery app for clients</li>
        <li>Video delivery and RAW file uploads</li>
        <li>Email marketing campaigns to your client list</li>
        <li>A print store with automatic lab fulfillment today</li>
        <li>A long track record: Pixieset has been around for years, and PhotoEZ Cloud is new</li>
      </ul>

      <h2>Where PhotoEZ Cloud is ahead</h2>
      <ul>
        <li>One app and one plan for booking, contracts, galleries, invoices, and reminders</li>
        <li>No limits on session types or contracts, even on the free plan</li>
        <li>Invoices with payment plans and automatic payment reminders</li>
        <li>AI inquiry help, culling, gallery search, and a Studio Assistant included</li>
        <li>Text reminders through your own Twilio account (Pro and Studio)</li>
        <li>No commission on your sales, on any plan</li>
        <li>
          Built by a working photographer, with a WordPress version too:{" "}
          <a href="https://photoez.net">PhotoEZ</a> runs on your own site, and you can move between the two
        </li>
      </ul>

      <h2>Try it without risk</h2>
      <p>
        PhotoEZ Cloud has a free plan that never expires, and every new account starts with a {TRIAL_DAYS}-day Pro
        trial with no card needed. Set up your studio page and a session, send yourself a test booking, and see how it
        feels before you move anything over. Then compare the plans on the <Link href="/pricing">pricing page</Link>.
      </p>
      <p>
        <Link href="/signup" className="btn-primary">
          Start your studio free
        </Link>
      </p>
      <p className="text-sm text-muted">
        Pixieset prices and limits are from pixieset.com&rsquo;s Client Gallery, Studio Manager, and Suite pricing pages,
        checked October 20, 2026. Pixieset is a trademark of its owner; this article isn&rsquo;t affiliated with or
        endorsed by Pixieset.
      </p>
    </>
  );
}
