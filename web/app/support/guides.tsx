import Link from "next/link";
import {
  CalendarIcon,
  CameraIcon,
  ContractIcon,
  GearIcon,
  GiftIcon,
  HeartIcon,
  ImagesIcon,
  InboxIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import { TRIAL_DAYS } from "@/lib/plans";

// The how-to guides on the Support page, one set for photographers and one
// for their clients. Button and menu names match the app's own words, so
// when a label changes in the dashboard, change it here too.

export type Guide = {
  id: string;
  title: string;
  // Extra words people might search for that aren't in the title.
  keywords?: string;
  body: React.ReactNode;
};

export type Topic = {
  id: string;
  title: string;
  blurb: string;
  icon: React.ReactNode;
  guides: Guide[];
};

const Steps = ({ children }: { children: React.ReactNode }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>;
const Bullets = ({ children }: { children: React.ReactNode }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>;
const Tip = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-xl bg-lime/10 px-4 py-3 text-sm">
    <strong>Good to know:</strong> {children}
  </p>
);
// A button, link, or field name exactly as it reads on screen.
const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold">{children}</strong>;
const Go = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="link">
    {children}
  </Link>
);

const icon = 22;

export const PHOTOGRAPHER_TOPICS: Topic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "Your account, studio page, and getting paid.",
    icon: <CameraIcon size={icon} />,
    guides: [
      {
        id: "create-account",
        title: "Create your account",
        keywords: "sign up signup register google trial confirm email",
        body: (
          <>
            <Steps>
              <li>
                Go to <Go href="/signup">Create your studio</Go>. Click <B>Continue with Google</B>, or fill in your
                name, business name (optional), email, and a password of at least 10 characters.
              </li>
              <li>
                Click <B>Create account</B>, then open the confirmation email and click its link. The link works for 24
                hours and signs you straight in.
              </li>
            </Steps>
            <Tip>
              Every new studio gets Pro free for {TRIAL_DAYS} days, no card needed. When it ends you move to Free and
              nothing is deleted. No email? Check your spam or promotions folder, or just log in and a fresh link is sent.
            </Tip>
          </>
        ),
      },
      {
        id: "setup-checklist",
        title: "Use the setup checklist",
        keywords: "overview get ready for clients onboarding",
        body: (
          <>
            <p>
              <B>Overview</B> starts with <B>Get ready for clients</B>, six steps that tick themselves off as you go:
              set up your studio page, connect Stripe, add a session, set your hours, upload your first gallery, and
              share your studio link. Click <B>Start →</B> on any step to jump to the right place.
            </p>
            <Tip>
              <B>Hide this</B> hides the checklist for good, so finish the steps you need first.
            </Tip>
          </>
        ),
      },
      {
        id: "studio-page",
        title: "Set up your studio page",
        keywords: "profile logo headshot page address slug url about tagline",
        body: (
          <>
            <Steps>
              <li>
                Open <Go href="/dashboard/settings#studio">Settings → Studio profile</Go>.
              </li>
              <li>
                Click <B>Upload logo</B> and <B>Add a photo</B> for your headshot. Both save right away. Pick a{" "}
                <B>Menu bar color</B> for the top of your pages.
              </li>
              <li>
                Fill in <B>Studio name</B> and <B>Page address</B>, your link at photoezcloud.com/studio/your-name. Add a
                tagline, <B>About the studio</B>, your service area, the <B>Sessions you offer</B>, and{" "}
                <B>Where you shoot</B>.
              </li>
              <li>
                Click <B>Save studio profile</B>, then <B>View your studio page</B> to see it.
              </li>
            </Steps>
            <Tip>
              The page address can use lowercase letters, numbers, and hyphens. Changing it later breaks links you&rsquo;ve
              already shared, so pick one you&rsquo;ll keep.
            </Tip>
          </>
        ),
      },
      {
        id: "connect-stripe",
        title: "Connect Stripe to take payments",
        keywords: "payments deposits card money payout",
        body: (
          <>
            <Steps>
              <li>
                Open <Go href="/dashboard/settings#payments">Settings → Payments</Go> and click <B>Connect Stripe</B>.
              </li>
              <li>Follow Stripe&rsquo;s sign-up screens. Stripe sends you back to Settings when you&rsquo;re done.</li>
              <li>
                If you see <B>Finish Stripe setup</B>, Stripe still needs a few details. Finish them, then click{" "}
                <B>Check again</B>. You&rsquo;re ready when it says <B>✓ Stripe connected</B>.
              </li>
            </Steps>
            <Tip>
              Clients pay you directly through your own Stripe account. PhotoEZ Cloud takes 0% (Stripe&rsquo;s own
              processing fees still apply). Without Stripe, bookings are confirmed with no deposit taken.
            </Tip>
          </>
        ),
      },
      {
        id: "password",
        title: "Reset your password",
        keywords: "forgot password login can't log in locked out",
        body: (
          <Steps>
            <li>
              On the <Go href="/login">login page</Go>, click <B>Forgot password?</B>.
            </li>
            <li>
              Enter your email and click <B>Send reset link</B>. The link works for one hour.
            </li>
            <li>
              Choose a new password (at least 10 characters), type it again, and click <B>Save new password</B>.
            </li>
          </Steps>
        ),
      },
    ],
  },
  {
    id: "booking",
    title: "Online booking",
    blurb: "Sessions, hours, contracts, and managing bookings.",
    icon: <CalendarIcon size={icon} />,
    guides: [
      {
        id: "add-session",
        title: "Add a session clients can book",
        keywords: "session type package price deposit length",
        body: (
          <>
            <Steps>
              <li>
                Open <Go href="/dashboard/bookings/setup#sessions">Bookings → Booking setup</Go> and click{" "}
                <B>Add session</B>.
              </li>
              <li>
                Fill in the name, a short summary, description, <B>Length (minutes)</B>, <B>Price ($)</B>, and{" "}
                <B>Deposit (%)</B>. 100% collects the full price at booking; 0% collects nothing up front.
              </li>
              <li>
                Optionally add a <B>Special price ($)</B> with a <B>Sale ends</B> date, choose a contract, and choose
                whether each booking gets a proofing gallery.
              </li>
              <li>
                Click <B>Add session</B>, then add a session photo on the next page.
              </li>
            </Steps>
            <Tip>
              Clients can&rsquo;t book until you have at least one session <em>and</em> you&rsquo;ve saved your hours.
              Use the ↑ ↓ buttons to change the order sessions show in.
            </Tip>
          </>
        ),
      },
      {
        id: "hours",
        title: "Set your hours and time off",
        keywords: "availability schedule open times buffer notice time zone vacation blackout",
        body: (
          <>
            <Steps>
              <li>
                In <Go href="/dashboard/bookings/setup#hours">Booking setup → Hours</Go>, set your <B>Time zone</B>,{" "}
                <B>Minimum notice (days)</B>, and <B>Buffer (minutes)</B> between sessions.
              </li>
              <li>
                Tick the days you work under <B>Weekly hours</B> and set opening and closing times, then click{" "}
                <B>Save hours</B>.
              </li>
              <li>
                To block days off, add a <B>First day</B> and <B>Last day</B> under <B>Time off</B> and click{" "}
                <B>Add</B>.
              </li>
            </Steps>
            <Tip>Time off doesn&rsquo;t touch bookings you already have.</Tip>
          </>
        ),
      },
      {
        id: "addons-coupons",
        title: "Offer add-ons and coupons",
        keywords: "extras upsell discount code promo",
        body: (
          <>
            <p>
              <strong>Add-ons:</strong> in Booking setup, click <B>Add add-on</B>, give it a name, price, and the most a
              client can add, then click <B>Add add-on</B>. Then open each session it belongs with and tick it under{" "}
              <B>Add-ons</B>. An add-on isn&rsquo;t offered anywhere until you do.
            </p>
            <p>
              <strong>Coupons:</strong> click <B>Add coupon</B>, enter a code, choose percent or dollars off, and set
              optional dates and use limits. Untick <B>Active</B> any time to pause it.
            </p>
          </>
        ),
      },
      {
        id: "booking-form",
        title: "Ask clients questions when they book",
        keywords: "custom questions booking form inspiration photos",
        body: (
          <>
            <p>
              In <Go href="/dashboard/bookings/setup#form">Booking setup → Booking form</Go>, click <B>Add question</B>.
              Choose short text, long text, a dropdown, or a yes/no checkbox, and whether it&rsquo;s required for every
              session or only some.
            </p>
            <p>
              On the same card, set <B>Inspiration photos</B> to Off, Optional (up to 10 images), or Required.
              Clients&rsquo; photos show on the booking.
            </p>
            <Tip>Name, email, phone, and notes are always asked, so you don&rsquo;t need to add them.</Tip>
          </>
        ),
      },
      {
        id: "contracts",
        title: "Set up contracts",
        keywords: "contract template sign signature agreement",
        body: (
          <>
            <Steps>
              <li>
                In <Go href="/dashboard/bookings/setup#contracts">Booking setup → Contracts</Go>, click{" "}
                <B>Start from PhotoEZ contract</B> for a starter to edit, or <B>Blank contract</B>.
              </li>
              <li>
                Click a fill-in tag like {"{{CLIENT_NAME}}"} or {"{{BOOKING_DATE}}"} to copy it, and paste it where the
                detail should go.
              </li>
              <li>
                Tick <B>Use as my default contract</B> if it should go with every session, then click{" "}
                <B>Save contract</B>.
              </li>
            </Steps>
            <Tip>
              Clients sign online right after booking. The same contracts can be attached to quotes and invoices.
            </Tip>
          </>
        ),
      },
      {
        id: "client-changes",
        title: "Let clients reschedule or cancel",
        keywords: "reschedule cancel policy notice refund credit",
        body: (
          <>
            <p>
              In Booking setup → <B>Client changes</B>, tick <B>Let clients reschedule and cancel online</B>. Set how
              many hours&rsquo; notice a reschedule needs, how many free reschedules they get, and the{" "}
              <B>Cancel notice for credit (hours)</B>. Then click <B>Save rules</B>.
            </p>
            <Tip>
              Cancelling earlier than the notice turns the deposit into a session credit; later is non-refundable. The
              rules are spelled out for clients on their booking page.
            </Tip>
          </>
        ),
      },
      {
        id: "manage-bookings",
        title: "Manage, move, or cancel a booking",
        keywords: "bookings calendar reschedule cancel mark completed refund",
        body: (
          <>
            <Bullets>
              <li>
                Open <Go href="/dashboard/bookings">Bookings → Bookings</Go>. Switch between <B>☰ List</B> and{" "}
                <B>▦ Calendar</B>.
              </li>
              <li>
                <strong>To move a session:</strong> in Calendar, drag the booking to another day or click it, change the
                date and time, tick the box to email them the new time, and click <B>Save</B>.
              </li>
              <li>
                <strong>To cancel:</strong> open the booking and click <B>Cancel booking</B>. The client is emailed and
                the time opens back up.
              </li>
              <li>
                After a session, click <B>Mark completed</B>.
              </li>
            </Bullets>
            <Tip>Refunds aren&rsquo;t automatic. Make them in your Stripe dashboard.</Tip>
          </>
        ),
      },
      {
        id: "reminders",
        title: "Send automatic reminders",
        keywords: "email reminder text sms session balance due",
        body: (
          <>
            <p>
              In <Go href="/dashboard/settings#email">Settings → Email</Go>, under <B>Automatic reminders</B>, choose
              when the <B>Session reminder</B> and <B>Balance due reminder</B> go out, then click{" "}
              <B>Save email settings</B>. Click <B>Send me a test email</B> to see how they look.
            </p>
            <p>
              Text reminders are under <Go href="/dashboard/settings#texts">Settings → Text messages</Go> (Pro and up).
              See &ldquo;Send text messages&rdquo; below.
            </p>
          </>
        ),
      },
      {
        id: "calendar-feed",
        title: "See bookings in Google, Apple, or Outlook Calendar",
        keywords: "calendar feed ical sync subscribe",
        body: (
          <>
            <Steps>
              <li>
                In <Go href="/dashboard/settings#calendar">Settings → Calendar</Go>, click <B>Get my calendar link</B>{" "}
                and then <B>Copy link</B>.
              </li>
              <li>
                Open <B>How to add it to your calendar</B> for the steps for your calendar app.
              </li>
            </Steps>
            <Tip>
              Keep the link private. If it&rsquo;s ever shared by mistake, click <B>Reset link</B>. Google can take a
              few hours to show changes.
            </Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "clients",
    title: "Inquiries, clients & reviews",
    blurb: "Answer new leads and keep track of clients.",
    icon: <InboxIcon size={icon} />,
    guides: [
      {
        id: "inquiries",
        title: "Answer an inquiry with the AI draft",
        keywords: "lead contact form triage reply email",
        body: (
          <>
            <Steps>
              <li>
                Messages from your studio page&rsquo;s contact form land in <Go href="/dashboard/inquiries">Clients → Inquiries</Go>.
                You also get an email.
              </li>
              <li>
                Open one. The AI pulls out the details (session, date, place, budget), their questions, and anything
                still needed. <B>Needs you</B> means it wants your personal touch, like a quote.
              </li>
              <li>
                Read and edit the <B>Draft reply</B>, then click <B>Send email</B>. Their reply comes to your email.
              </li>
              <li>
                Click <B>Create client</B> to save them as a client, or <B>Create a quote</B> to send pricing.
              </li>
            </Steps>
            <Tip>
              The AI writes from your studio profile and <Go href="/dashboard/settings#faq">Client FAQ</Go>, so the more
              you fill in there, the better the replies. It never quotes prices or promises dates.
            </Tip>
          </>
        ),
      },
      {
        id: "manual-inquiry",
        title: "Add an inquiry from email or social media",
        keywords: "paste message instagram facebook dm new inquiry",
        body: (
          <Steps>
            <li>
              In Inquiries, click <B>New inquiry</B>.
            </li>
            <li>Paste the whole message, signature included, and optionally their name and email.</li>
            <li>
              Click <B>Triage with AI</B>. It takes 10 to 20 seconds.
            </li>
          </Steps>
        ),
      },
      {
        id: "auto-replies",
        title: "Send AI replies automatically",
        keywords: "auto reply automatic inquiry",
        body: (
          <p>
            In <Go href="/dashboard/settings#email">Settings → Email</Go>, tick{" "}
            <B>Send AI replies to inquiries automatically</B> and save. It only sends replies the AI could fully answer.
            Anything marked <B>Needs you</B> still waits for you.
          </p>
        ),
      },
      {
        id: "clients",
        title: "Add and manage clients",
        keywords: "client list contact notes delete",
        body: (
          <>
            <p>
              In <Go href="/dashboard/clients">Clients → Clients</Go>, click <B>Add client</B> and fill in a name, plus
              email, phone, and notes if you have them. Clients are also added for you when someone books, or when you
              send a quote or invoice to a new email.
            </p>
            <p>
              A client&rsquo;s page shows their quotes and invoices, session credits, and text-message consent.
            </p>
          </>
        ),
      },
      {
        id: "credits",
        title: "Give a client a session credit",
        keywords: "credit balance refund goodwill",
        body: (
          <>
            <p>
              Open the client, find <B>Session credits</B>, and fill in <B>Add a credit</B>: the amount, a private reason,
              and an optional expiry. Click <B>Add credit</B>.
            </p>
            <Tip>
              The client needs an email address on file. The credit is offered automatically the next time they book
              with that email.
            </Tip>
          </>
        ),
      },
      {
        id: "reviews",
        title: "Ask for reviews and show them",
        keywords: "testimonial rating stars google review",
        body: (
          <>
            <Steps>
              <li>
                Open a delivered gallery and click <B>Ask for a review</B>. Or have it sent for you: in{" "}
                <Go href="/dashboard/settings#reviews">Settings → Reviews</Go>, choose how long after delivery to ask.
              </li>
              <li>
                Add your <B>Google review link</B> there too, so happy clients are invited to post on Google as well.
              </li>
              <li>
                New reviews wait in <Go href="/dashboard/reviews">Clients → Reviews</Go>. Click{" "}
                <B>Approve &amp; publish</B> to show one on your studio page, or <B>Hide</B>.
              </li>
            </Steps>
          </>
        ),
      },
    ],
  },
  {
    id: "invoices",
    title: "Quotes & invoices",
    blurb: "Send pricing, take deposits, and set up payment plans.",
    icon: <ContractIcon size={icon} />,
    guides: [
      {
        id: "send-invoice",
        title: "Send a quote or invoice",
        keywords: "bill estimate pricing proposal",
        body: (
          <>
            <Steps>
              <li>
                Open <Go href="/dashboard/invoices">Clients → Quotes &amp; invoices</Go> and click <B>New quote</B> or{" "}
                <B>New invoice</B>.
              </li>
              <li>Choose a client or type a new one&rsquo;s details. An email is needed to send it.</li>
              <li>
                Add a title and line items, then choose <B>How the client pays</B>: paid in full, deposit + balance, or
                a payment plan.
              </li>
              <li>
                Attach a contract if you like, then click <B>Save &amp; send</B>, or <B>Save as draft</B> to send later.
              </li>
            </Steps>
            <Tip>
              A quote has to be approved by the client before it can be signed or paid. On a quote,{" "}
              <B>Copy as invoice</B> turns it into an invoice. Quotes and invoices are on Pro and up.
            </Tip>
          </>
        ),
      },
      {
        id: "payment-plans",
        title: "Set up a payment plan",
        keywords: "installments monthly deposit balance",
        body: (
          <>
            <p>
              Under <B>How the client pays</B>, choose <B>Payment plan</B>. Set the deposit, the number of payments
              (up to 24), how often (monthly, every 2 weeks, or weekly), and the first due date.
            </p>
            <Tip>
              Clients get an email reminder 3 days before each payment and can always pay more, or the whole balance,
              early.
            </Tip>
          </>
        ),
      },
      {
        id: "record-payment",
        title: "Record a cash or check payment",
        keywords: "manual payment offline venmo zelle",
        body: (
          <p>
            Open the invoice and, under <B>Payments</B>, click <B>+ Record a payment (cash, check…)</B>. Enter the amount,
            date, and how they paid, then click <B>Record payment</B>.
          </p>
        ),
      },
    ],
  },
  {
    id: "galleries",
    title: "Galleries",
    blurb: "Upload, proof, and deliver photos.",
    icon: <ImagesIcon size={icon} />,
    guides: [
      {
        id: "create-gallery",
        title: "Create a gallery",
        keywords: "new gallery proofing album",
        body: (
          <>
            <Steps>
              <li>
                In <Go href="/dashboard/galleries">Galleries</Go>, click <B>New gallery</B>.
              </li>
              <li>
                Give it a title and pick the client. Set <B>Free picks</B>, how many photos the client can choose (0 means
                no limit).
              </li>
              <li>
                Click <B>Create gallery</B>.
              </li>
            </Steps>
            <Tip>A gallery is made for you when a booking is confirmed, unless the session is set to &ldquo;No gallery&rdquo;.</Tip>
          </>
        ),
      },
      {
        id: "upload",
        title: "Upload photos",
        keywords: "upload drag drop files lightroom bulk",
        body: (
          <>
            <p>
              A gallery has two parts: <B>1 Proofs</B>, which your client picks favorites from, and <B>2 Finals</B>, the
              edited photos they download. Drag photos onto either one, or click <B>Choose photos</B>.
            </p>
            <Tip>
              JPEG, PNG, or WebP, up to 50 MB each and 1,000 at a time. If dragging from Lightroom or a zip doesn&rsquo;t
              work, export to a folder first and use <B>Choose photos</B>.
            </Tip>
          </>
        ),
      },
      {
        id: "watermark",
        title: "Add a watermark to proofs",
        keywords: "logo watermark protect proofs",
        body: (
          <>
            <Steps>
              <li>
                In <Go href="/dashboard/settings">Settings → Proofing</Go>, click <B>Browse</B> and choose a PNG (a
                transparent background looks best).
              </li>
              <li>
                Set the <B>Opacity</B> and <B>Position</B>, check the preview, and click <B>Save watermark</B>.
              </li>
              <li>
                For photos already uploaded, open the gallery and click <B>Update proofs</B>.
              </li>
            </Steps>
            <Tip>Watermarks only go on proofs. Finals are never watermarked.</Tip>
          </>
        ),
      },
      {
        id: "share-gallery",
        title: "Send the gallery to your client",
        keywords: "share link email client preview",
        body: (
          <>
            <p>
              On the gallery page, use the <B>Client gallery link</B> card: <B>Copy link</B> to paste it anywhere, or{" "}
              <B>Email gallery link</B> to send it. <B>Preview as client</B> shows exactly what they&rsquo;ll see.
            </p>
            <Tip>
              Creating a gallery doesn&rsquo;t email anyone, so send the link when it&rsquo;s ready. Anyone with the link
              can view the gallery.
            </Tip>
          </>
        ),
      },
      {
        id: "picks",
        title: "See your client's picks and sell extra photos",
        keywords: "favorites selections extras upsell notes reopen",
        body: (
          <>
            <p>
              The gallery shows how many photos your client has picked. When they submit, you get an email.{" "}
              <B>Copy file names</B> copies their picks to paste into Lightroom&rsquo;s filename search. Need them to
              change their picks? Click <B>Reopen selections</B>.
            </p>
            <p>
              To sell photos beyond the free picks, set a <B>Price per extra photo ($)</B> in{" "}
              <Go href="/dashboard/settings">Settings → Additional Photos</Go> (Pro and up). Clients pay through Stripe
              when they submit.
            </p>
          </>
        ),
      },
      {
        id: "deliver",
        title: "Deliver final photos",
        keywords: "deliver finals download full resolution",
        body: (
          <>
            <Steps>
              <li>
                Upload your edited photos to <B>2 Finals</B>.
              </li>
              <li>
                Click <B>Deliver to client →</B> and confirm. Their link switches to a download page, and they&rsquo;re
                emailed.
              </li>
            </Steps>
            <Tip>
              You can deliver without proofing first, which is handy for events. <B>Undo delivery</B> takes it back.
            </Tip>
          </>
        ),
      },
      {
        id: "slideshow",
        title: "Add a slideshow with music",
        keywords: "slideshow music song",
        body: (
          <p>
            In <B>2 Finals</B>, the <B>Slideshow with music</B> card is on by default. Click <B>Upload a song</B> (MP3,
            M4A, AAC, or WAV, up to 60 MB). Clients see a <B>▶ Slideshow</B> button once the gallery is delivered.
            Slideshows are on Pro and up.
          </p>
        ),
      },
      {
        id: "gallery-status",
        title: "Close a gallery or mark it completed",
        keywords: "status completed expired archive limit active galleries",
        body: (
          <>
            <p>
              On the gallery page, use <B>Change status</B> in the <B>Gallery status</B> card. Choose <B>Completed</B>{" "}
              when you&rsquo;re all done (the client can still download), or <B>Expired</B> to close it.
            </p>
            <Tip>
              Completed and expired galleries don&rsquo;t count toward the Free plan&rsquo;s 3 active galleries.
            </Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "ai",
    title: "AI tools",
    blurb: "Culling help, gallery search, and the Studio Assistant.",
    icon: <SparklesIcon size={icon} />,
    guides: [
      {
        id: "culling",
        title: "Find blurry, dark, and duplicate photos",
        keywords: "culling cull blur closed eyes exposure duplicates",
        body: (
          <>
            <Steps>
              <li>
                In a gallery&rsquo;s <B>1 Proofs</B>, find <B>✨ Culling help</B> and click <B>Check photos</B>.
              </li>
              <li>
                Click a chip like <B>Blurry</B>, <B>Closed eyes</B>, or <B>Near-duplicate</B> to see those photos.
              </li>
              <li>
                Delete the ones you don&rsquo;t want, or use <B>Keep the best</B> on duplicates to keep the sharpest of
                each set.
              </li>
            </Steps>
            <Tip>
              It runs in your browser, so it&rsquo;s free on every plan and your photos stay private. Keep the page open
              while it checks. Photos your client picked are never deleted.
            </Tip>
          </>
        ),
      },
      {
        id: "gallery-search",
        title: "Make a gallery searchable",
        keywords: "search photos tags find first dance",
        body: (
          <>
            <p>
              On the gallery page, in <B>🔎 Gallery search</B>, click <B>Make photos searchable</B>. Then you and your
              client can find photos with plain words like &ldquo;first dance&rdquo; or &ldquo;outdoors&rdquo;.
            </p>
            <Tip>
              Each photo counts once toward your monthly allowance (100 on Free, 3,000 on Pro, 10,000 on Studio). Run it
              again after uploading finals.
            </Tip>
          </>
        ),
      },
      {
        id: "assistant",
        title: "Ask the Studio Assistant",
        keywords: "assistant ai chat questions reminders",
        body: (
          <>
            <p>
              Open <Go href="/dashboard/assistant">Assistant</Go> and ask things like &ldquo;Who still owes a
              balance?&rdquo; or &ldquo;Which galleries close this week?&rdquo;. It can also draft emails, captions, and
              review replies.
            </p>
            <p>
              When it offers to do something, like emailing reminders, it shows a <B>Ready for your approval</B> card.
              Nothing is sent until you click <B>Approve</B>. Cards expire after 24 hours.
            </p>
            <Tip>Answers can be wrong, so check before approving. Free includes 10 questions a month, Pro 300.</Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "grow",
    title: "Grow your studio",
    blurb: "Gift cards, referrals, the directory, and your page design.",
    icon: <GiftIcon size={icon} />,
    guides: [
      {
        id: "design",
        title: "Design your studio page and galleries",
        keywords: "page designer theme colors fonts banner layout",
        body: (
          <>
            <Steps>
              <li>
                Open <Go href="/dashboard/design">Settings → Design</Go>.
              </li>
              <li>
                Start from a theme, then pick your main and accent colors, fonts, button style, banner, and client
                gallery layout. The <B>Live preview</B> updates as you go.
              </li>
              <li>
                Click <B>Save design</B>. Nothing changes for clients until you save.
              </li>
            </Steps>
            <Tip>Your logo and menu bar color are in Settings → Studio profile.</Tip>
          </>
        ),
      },
      {
        id: "gift-cards",
        title: "Sell gift cards",
        keywords: "gift certificate voucher",
        body: (
          <>
            <p>
              In <Go href="/dashboard/settings#gift-cards">Settings → Gift cards</Go>, tick{" "}
              <B>Sell gift cards on my studio page</B>, enter up to 6 amounts, and click <B>Save gift card settings</B>.
              Stripe must be connected.
            </p>
            <p>
              To give one away free, open <Go href="/dashboard/gift-cards">Bookings → Gift cards</Go> and use{" "}
              <B>Issue a gift card</B>. Gift cards never expire.
            </p>
          </>
        ),
      },
      {
        id: "client-referrals",
        title: "Reward clients who refer friends",
        keywords: "referral friend discount credit share",
        body: (
          <p>
            In <Go href="/dashboard/settings#client-referrals">Settings → Client referrals</Go>, tick{" "}
            <B>Turn on client referrals</B> and set the friend&rsquo;s discount and the credit for the client who shared.
            Each client gets a share link on their booking page and final-photos email. They earn the credit after their
            friend&rsquo;s session.
          </p>
        ),
      },
      {
        id: "directory",
        title: "List your studio in the photographer directory",
        keywords: "directory find a photographer listing seo",
        body: (
          <>
            <p>
              In <Go href="/dashboard/settings#directory">Settings → Photographer directory</Go>, enter your studio ZIP
              code, tick <B>List my studio in the directory</B>, and click <B>Save</B>. It&rsquo;s free on every plan.
            </p>
            <Tip>
              You&rsquo;re listed once your studio page has an address, an About section, and at least one session.
              Only your city is shown.
            </Tip>
          </>
        ),
      },
      {
        id: "refer-photographer",
        title: "Refer another photographer",
        keywords: "referral link free month",
        body: (
          <p>
            Open <Go href="/dashboard/billing#refer">Settings → Refer a photographer</Go> and click <B>Copy link</B>. They
            get the Pro trial plus 20% off their first payment, and you get a month of your plan free when they pay.
          </p>
        ),
      },
    ],
  },
  {
    id: "account",
    title: "Plans, email & settings",
    blurb: "Billing, storage, emails, and text messages.",
    icon: <GearIcon size={icon} />,
    guides: [
      {
        id: "plans",
        title: "Change or cancel your plan",
        keywords: "upgrade downgrade billing subscription cancel pro studio",
        body: (
          <>
            <p>
              Open <Go href="/dashboard/billing">Settings → Billing</Go>. Choose Monthly or Yearly, then click{" "}
              <B>Choose Pro</B> or <B>Choose Studio</B>. Already paying? <B>Manage billing</B> lets you switch plans,
              update your card, see invoices, or cancel.
            </p>
            <Tip>
              Cancelling keeps your plan until the end of the period you&rsquo;ve paid for. Nothing is ever deleted when
              you go over a Free limit; you just can&rsquo;t add more until you upgrade or mark galleries Completed. See{" "}
              <Go href="/pricing">Pricing</Go> for what each plan includes.
            </Tip>
          </>
        ),
      },
      {
        id: "storage",
        title: "Add more storage",
        keywords: "storage space full gb tb",
        body: (
          <p>
            On a paid Pro or Studio plan, open <Go href="/dashboard/billing">Billing</Go>, pick an amount under{" "}
            <B>Extra storage</B> (500 GB blocks), and click <B>Add storage</B>. <B>What you&rsquo;re using</B> on the same
            page shows how much you have left.
          </p>
        ),
      },
      {
        id: "emails",
        title: "Choose where emails go and check what was sent",
        keywords: "email notices inbox log not received spam",
        body: (
          <>
            <p>
              Emails to clients go out with your studio name, and their replies come to you. Set where in{" "}
              <Go href="/dashboard/settings#email">Settings → Email</Go> under{" "}
              <B>Your email for notices and client replies</B> (blank uses your login email).
            </p>
            <p>
              <Go href="/dashboard/emails">Settings → Email log</Go> lists every email sent, with <B>Sent</B>,{" "}
              <B>Failed</B>, or <B>Not sent</B>. Click one to see it exactly as it went out.
            </p>
          </>
        ),
      },
      {
        id: "texts",
        title: "Send text messages",
        keywords: "sms text twilio reminders a2p 10dlc stop",
        body: (
          <>
            <Steps>
              <li>
                Make a <a href="https://www.twilio.com" className="link">Twilio</a> account and get a phone number. Twilio
                bills you directly.
              </li>
              <li>
                In <Go href="/dashboard/settings#texts">Settings → Text messages</Go>, enter your Twilio Account SID,
                Auth Token, number, business name, and state, choose <B>Which texts go out</B>, and click{" "}
                <B>Save text settings</B>.
              </li>
              <li>
                Follow the steps on that card to set up STOP replies and US texting registration (A2P 10DLC), then click{" "}
                <B>Send test text</B>.
              </li>
            </Steps>
            <Tip>
              Texts are on Pro and up. Clients only get texts after they agree to them, and replying STOP ends them.
              Until your Twilio registration is approved, texts may show as sent but never arrive.
            </Tip>
          </>
        ),
      },
      {
        id: "wordpress",
        title: "Move from PhotoEZ for WordPress",
        keywords: "migrate import migration wordpress plugin",
        body: (
          <>
            <Steps>
              <li>On your WordPress site, install the free PhotoEZ Migration plugin.</li>
              <li>
                In WordPress, go to <B>PhotoEZ → Migration</B> and click <B>Make a migration key</B>.
              </li>
              <li>
                In <Go href="/dashboard/settings#import">Settings → Move from PhotoEZ for WordPress</Go>, enter your site
                address and the key, and click <B>Connect</B>.
              </li>
              <li>
                Choose what to bring over (clients, sessions, contracts, bookings, galleries, and more) and click{" "}
                <B>Start import</B>. Keep the page open until it finishes.
              </li>
            </Steps>
            <Tip>
              Nothing changes on your WordPress site, and running it again won&rsquo;t make duplicates. Large photo
              libraries may need Pro, since Free holds 3 active galleries and 3 GB.
            </Tip>
          </>
        ),
      },
    ],
  },
];

export const CLIENT_TOPICS: Topic[] = [
  {
    id: "booking",
    title: "Booking a session",
    blurb: "Choosing a time, paying, and signing.",
    icon: <CalendarIcon size={icon} />,
    guides: [
      {
        id: "book",
        title: "Book a session",
        keywords: "schedule appointment book now",
        body: (
          <>
            <Steps>
              <li>
                On your photographer&rsquo;s page, click <B>Book now</B> or <B>Book a session</B>.
              </li>
              <li>Choose a session, then a day and a time. Times are in the studio&rsquo;s time zone.</li>
              <li>Add any extras, then fill in your details. Enter a coupon or gift card code here if you have one.</li>
              <li>
                Click <B>Confirm booking</B>. If a deposit is due, you&rsquo;ll pay it securely with Stripe. Your time is
                held for 30 minutes while you pay.
              </li>
            </Steps>
            <Tip>You&rsquo;ll get a confirmation email with a link to your booking. Keep it to pay, sign, or make changes.</Tip>
          </>
        ),
      },
      {
        id: "contract",
        title: "Sign your contract",
        keywords: "contract signature agreement",
        body: (
          <Steps>
            <li>
              Open the link in your booking or invoice email and click <B>Read &amp; sign</B>.
            </li>
            <li>
              Read the contract, type your full legal name, and draw or type your signature.
            </li>
            <li>
              Tick the box to agree and click <B>Sign contract</B>. You can view your signed copy from the same page any
              time.
            </li>
          </Steps>
        ),
      },
      {
        id: "pay",
        title: "Pay a deposit, balance, or invoice",
        keywords: "payment card pay invoice quote approve receipt",
        body: (
          <>
            <p>
              Open the link from your photographer&rsquo;s email and click <B>Pay</B>. Payments go through Stripe, and a
              receipt is emailed to you. On a payment plan you&rsquo;ll get a reminder 3 days before each payment, and
              you can always pay more early.
            </p>
            <p>
              Got a quote? Click <B>Approve quote</B> to go ahead (or <B>Decline</B>), then sign and pay if asked.
            </p>
            <Tip>
              Use <B>Print / Save as PDF</B> on an invoice for your records. For refunds, contact your photographer.
            </Tip>
          </>
        ),
      },
      {
        id: "reschedule",
        title: "Reschedule or cancel",
        keywords: "change date move cancel",
        body: (
          <>
            <p>
              Open your booking link and look for <B>Need to make a change?</B>. Click <B>Reschedule</B> to pick a new
              time, or <B>Cancel booking</B>. The page explains what happens to your deposit before you confirm.
            </p>
            <Tip>
              Don&rsquo;t see those buttons? Your photographer handles changes personally, so reply to their email.
            </Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "gallery",
    title: "Your photo gallery",
    blurb: "Picking favorites and downloading photos.",
    icon: <HeartIcon size={icon} />,
    guides: [
      {
        id: "favorites",
        title: "Pick your favorite photos",
        keywords: "favorites heart select proofs submit selections notes",
        body: (
          <>
            <Steps>
              <li>Open the gallery link your photographer sent you. No account or password is needed.</li>
              <li>
                Tap the heart on each photo you love. <B>My picks</B> shows just your choices.
              </li>
              <li>
                Want an edit? Open a picked photo and write it in <B>Note for the photographer</B>.
              </li>
              <li>
                When you&rsquo;re happy, click <B>Submit my selections →</B>. If you picked extra photos, you&rsquo;ll pay
                for them first.
              </li>
            </Steps>
            <Tip>
              You can&rsquo;t change your picks after submitting. If you need to, ask your photographer to reopen them.
            </Tip>
          </>
        ),
      },
      {
        id: "download",
        title: "Download your photos",
        keywords: "download zip full resolution save",
        body: (
          <>
            <p>
              When your photos are ready, you&rsquo;ll get an email and the same gallery link becomes your download page.
              Click <B>Download all</B> for a ZIP of every photo, or the download icon on any photo to save just that
              one.
            </p>
            <Tip>
              Downloads are full resolution and unwatermarked. If your photographer added one, click <B>▶ Slideshow</B>{" "}
              to watch them with music.
            </Tip>
          </>
        ),
      },
      {
        id: "expired",
        title: "My gallery says it has expired",
        keywords: "expired closed missing link",
        body: <p>Your photographer closed the gallery. Contact them and they can reopen it or send your photos another way.</p>,
      },
    ],
  },
  {
    id: "more",
    title: "Reviews, gift cards & texts",
    blurb: "Everything else.",
    icon: <StarIcon size={icon} />,
    guides: [
      {
        id: "review",
        title: "Leave a review",
        keywords: "review rating stars testimonial",
        body: (
          <p>
            Open the review link your photographer emailed you, choose a star rating, write a few words, and click{" "}
            <B>Send my review</B>. You can add a favorite photo from your session if you&rsquo;d like. Your photographer
            approves reviews before they appear on their page.
          </p>
        ),
      },
      {
        id: "gift-card",
        title: "Buy or use a gift card",
        keywords: "gift card certificate redeem code",
        body: (
          <>
            <p>
              <strong>To buy one:</strong> click <B>Gift cards</B> on the photographer&rsquo;s page, choose an amount, fill
              in who it&rsquo;s for and when to send it, and click <B>Continue to pay</B>.
            </p>
            <p>
              <strong>To use one:</strong> enter the code (like GIFT-XXXX-XXXX) in the <B>Gift card</B> box when you book.
              Any amount left stays on the card for next time. Gift cards never expire.
            </p>
          </>
        ),
      },
      {
        id: "texts",
        title: "Start or stop text reminders",
        keywords: "sms text stop start unsubscribe",
        body: (
          <p>
            Tick <B>Text me reminders</B> when you book to get texts about your session. Reply <strong>STOP</strong> to
            any text to stop them, or <strong>START</strong> to turn them back on.
          </p>
        ),
      },
      {
        id: "no-email",
        title: "I didn't get an email",
        keywords: "missing email spam link not received",
        body: (
          <p>
            Check your spam or promotions folder for an email from your photographer&rsquo;s studio name. Still nothing?
            Ask your photographer to send the link again. They can resend it from their dashboard.
          </p>
        ),
      },
    ],
  },
];

