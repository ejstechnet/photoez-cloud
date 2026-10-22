// GrowthPilot's starting data, put in place by lib/growth/seed.ts. After
// that the Growth pages own it: editing this file doesn't change rows that
// already exist.
//
// Features were checked on 2026-10-21 against photoezcloud.com (home and
// /pricing) and this code. Only "live" and "partial" ones may appear in a
// drafted reply. When PhotoEZ Cloud ships something, update it on the Growth
// Features page (and here, for new installs).
import type { GROWTH_FEATURE_AREAS, GROWTH_FEATURE_STATUSES, GROWTH_KEYWORD_GROUPS, GROWTH_PLATFORMS } from "./constants";

export const SEED_VERIFIED_AT = "2026-10-21";

type Feature = {
  key: string;
  name: string;
  area: (typeof GROWTH_FEATURE_AREAS)[number];
  status: (typeof GROWTH_FEATURE_STATUSES)[number];
  plans?: string;
  replyNote?: string;
  evidenceUrl?: string;
};

const HOME = "https://photoezcloud.com/";
const PRICING = "https://photoezcloud.com/pricing";

export const SEED_FEATURES: Feature[] = [
  // Running the studio
  { key: "studio_page", name: "Studio page with work, sessions, reviews and FAQ, plus an inquiry form", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "inquiry_triage", name: "AI inquiry triage: inquiries arrive sorted, with a reply drafted", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "online_booking", name: "Step-by-step online booking with real open times, buffers and time off", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "deposits", name: "Deposits and balances paid to the photographer's own Stripe", area: "studio", status: "live", replyNote: "0% PhotoEZ commission; Stripe's own fees still apply.", evidenceUrl: PRICING },
  { key: "client_reschedule", name: "Clients reschedule or cancel themselves, by the studio's rules", area: "studio", status: "live" },
  { key: "auto_gallery", name: "A gallery is made automatically when a client books", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "contracts", name: "Contracts signed online, filled in from the booking", area: "studio", status: "live", evidenceUrl: PRICING },
  { key: "invoices", name: "Quotes and invoices with payment plans", area: "studio", status: "live", plans: "Pro, Studio", evidenceUrl: PRICING },
  { key: "gift_cards_coupons", name: "Gift cards and coupons", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "reviews", name: "Reviews requested after delivery and approved by the photographer", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "emails_reminders", name: "Confirmation, reminder and gallery emails sent automatically", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "text_reminders", name: "Text reminders", area: "studio", status: "live", plans: "Pro, Studio", replyNote: "Needs the studio's own Twilio account and text-message registration.", evidenceUrl: PRICING },
  { key: "page_designer", name: "Page Designer: colors, fonts, banner and gallery style", area: "studio", status: "live", evidenceUrl: HOME },
  { key: "calendar_feed", name: "Calendar feed to subscribe to in Google or Apple Calendar", area: "studio", status: "live", replyNote: "One-way feed, not two-way sync." },
  { key: "google_sign_in", name: "Sign in with Google", area: "studio", status: "live" },
  { key: "wordpress_move", name: "Move between PhotoEZ for WordPress and PhotoEZ Cloud", area: "studio", status: "live" },
  { key: "studio_assistant", name: "Studio Assistant: asks before it acts", area: "studio", status: "live", plans: "Free 10/mo, Pro 300, Studio 1,000 questions", evidenceUrl: PRICING },
  // Galleries and delivery
  { key: "proofing", name: "Proofing galleries: watermarked proofs, favorites, client notes, selection limit", area: "galleries", status: "live", evidenceUrl: PRICING },
  { key: "gallery_upsells", name: "Sell extra photos beyond the package", area: "galleries", status: "live", plans: "Pro, Studio", evidenceUrl: PRICING },
  { key: "final_delivery", name: "Final delivery: clean full-resolution downloads and a ZIP", area: "galleries", status: "live", evidenceUrl: HOME },
  { key: "slideshows", name: "Slideshows with the photographer's own music", area: "galleries", status: "live", plans: "Pro, Studio", evidenceUrl: PRICING },
  { key: "ai_search", name: "AI gallery search (\"first dance\", \"shots with grandma\")", area: "galleries", status: "live", plans: "Free 100/mo, Pro 3,000, Studio 10,000 photos", evidenceUrl: PRICING },
  { key: "ai_culling", name: "AI culling help: blurry frames, closed eyes, near-duplicates, flash misfires", area: "galleries", status: "live", replyNote: "Runs in the browser, so it's unlimited on every plan.", evidenceUrl: PRICING },
  { key: "large_uploads", name: "Large uploads, up to 1,000 photos at a time", area: "galleries", status: "live" },
  { key: "storage", name: "Photo storage", area: "galleries", status: "live", plans: "Free 3 GB, Pro 150 GB, Studio 2 TB; +500 GB for $10/mo", evidenceUrl: PRICING },
  { key: "active_galleries", name: "Active galleries", area: "galleries", status: "live", plans: "Free 3; Pro and Studio unlimited", evidenceUrl: PRICING },
  // Selling and growth
  { key: "online_store", name: "Online store in galleries: photo prints and gifts", area: "selling", status: "partial", replyNote: "Say \"prints and gifts\"; a small range for now (opened 2026-10-21), more coming. Don't promise a full catalog.", evidenceUrl: HOME },
  { key: "swaggpress", name: "SwaggPress Creations makes and ships prints, at prices the photographer sets", area: "selling", status: "live", evidenceUrl: HOME },
  { key: "self_fulfilled", name: "Sell products the photographer makes themselves", area: "selling", status: "live", evidenceUrl: HOME },
  { key: "directory", name: "Photographer directory, searchable by ZIP or city", area: "selling", status: "partial", replyNote: "Live, but few studios are listed yet. Never promise leads from it.", evidenceUrl: HOME },
  { key: "referrals", name: "Referral programs for photographers and their clients", area: "selling", status: "live", evidenceUrl: HOME },
  { key: "pricing", name: "Free plan, Pro $29/mo, Studio $49/mo, 14-day Pro trial with no card", area: "selling", status: "live", evidenceUrl: PRICING },
  // Not offered: listed so a draft never implies them.
  { key: "event_sales", name: "Event galleries with face or bib search and bulk event print sales", area: "galleries", status: "not_offered", replyNote: "That's PhotoEZ Event Gallery for WordPress, not PhotoEZ Cloud." },
  { key: "team_accounts", name: "Team or second-photographer accounts", area: "studio", status: "not_offered", replyNote: "One photographer per studio for now." },
  { key: "two_way_calendar", name: "Two-way Google Calendar sync", area: "studio", status: "not_offered", replyNote: "There's a one-way calendar feed only." },
  { key: "mobile_app", name: "A native phone app", area: "studio", status: "not_offered", replyNote: "Web only; it works on phones." },
  { key: "email_marketing", name: "CRM and email marketing campaigns", area: "studio", status: "not_offered" },
];

type Keyword = { group: (typeof GROWTH_KEYWORD_GROUPS)[number]; phrase: string };

export const SEED_KEYWORDS: Keyword[] = [
  ...["Pixieset alternative", "HoneyBook alternative", "ShootProof alternative", "Pic-Time alternative", "CloudSpot alternative", "Dubsado alternative", "Studio Ninja alternative"].map(
    (phrase) => ({ group: "alternatives" as const, phrase }),
  ),
  ...["client proofing gallery", "photo proofing software", "client gallery software", "deliver photos to clients", "sell prints from client gallery"].map(
    (phrase) => ({ group: "proofing_galleries" as const, phrase }),
  ),
  ...["photography booking software", "photography contract software", "photography studio management software", "too many apps photography business", "photography invoicing software"].map(
    (phrase) => ({ group: "business_management" as const, phrase }),
  ),
  ...["what do you use for client galleries", "recommend gallery software", "switching from Pixieset", "looking for booking software photographer", "cheaper than Pixieset"].map(
    (phrase) => ({ group: "buying_intent" as const, phrase }),
  ),
  ...["camera recommendation", "lens recommendation", "Lightroom preset", "editing help", "looking to hire a photographer"].map(
    (phrase) => ({ group: "negative" as const, phrase }),
  ),
];

type Source = {
  name: string;
  platform: (typeof GROWTH_PLATFORMS)[number];
  linksAllowed: boolean;
  selfPromoAllowed: boolean;
  rulesNote: string;
};

export const SEED_SOURCES: Source[] = [
  {
    name: "Manual capture",
    platform: "other",
    linksAllowed: false,
    selfPromoAllowed: false,
    rulesNote: "For one-off posts. Rules unknown, so drafts play it safe: no link, no pitch.",
  },
  {
    name: "My main photography Facebook group",
    platform: "facebook",
    linksAllowed: false,
    selfPromoAllowed: false,
    rulesNote: "Links get blocked here (seen 2026-10-20). Rename this to the group's real name and check its rules.",
  },
];
