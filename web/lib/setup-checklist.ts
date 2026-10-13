// The dashboard's welcome checklist: the six things a new studio does before
// it's ready for clients. Each step ticks itself off from what the studio has
// already done, so nothing is checked by hand except copying the studio link.
// The card goes away once every step is done or the photographer hides it.
// Decided with Elle 2026-10-12 (launch-ready round). Tested in setup-checklist.test.ts.

export type SetupFacts = {
  studioSlug: string | null;
  hasPicture: boolean; // a studio logo or a headshot
  stripeReady: boolean;
  sessionCount: number; // sessions clients can see
  hoursCount: number; // days with working hours
  galleryCount: number;
  linkCopied: boolean;
  // A client already found them: a booking, or an inquiry sent from their page
  // or the directory. Counts as sharing for studios that set up before this card.
  clientFound: boolean;
};

export type SetupStep = {
  key: "studio" | "stripe" | "session" | "hours" | "gallery" | "share";
  title: string;
  detail: string;
  href: string;
  done: boolean;
};

export function setupSteps(f: SetupFacts): SetupStep[] {
  return [
    {
      key: "studio",
      title: "Set up your studio page",
      detail: "Pick its web address and add your logo or headshot.",
      href: "/dashboard/settings#studio",
      done: Boolean(f.studioSlug) && f.hasPicture,
    },
    {
      key: "stripe",
      title: "Connect Stripe",
      detail: "So deposits and balances go straight to your own account.",
      href: "/dashboard/settings#payments",
      done: f.stripeReady,
    },
    {
      key: "session",
      title: "Add a session",
      detail: "What clients can book, with its price and length.",
      href: "/dashboard/bookings/setup#sessions",
      done: f.sessionCount > 0,
    },
    {
      key: "hours",
      title: "Set your hours",
      detail: "The days and times clients can book you.",
      href: "/dashboard/bookings/setup#hours",
      done: f.hoursCount > 0,
    },
    {
      key: "gallery",
      title: "Upload your first gallery",
      detail: "Proofs for a client to pick from, or finished photos to deliver.",
      href: "/dashboard/galleries/new",
      done: f.galleryCount > 0,
    },
    {
      key: "share",
      title: "Share your studio link",
      detail: f.studioSlug
        ? "Copy it into your Instagram bio, Facebook page, and email signature."
        : "Set up your studio page first to get your link.",
      href: f.studioSlug ? `/studio/${f.studioSlug}` : "/dashboard/settings#studio",
      done: f.linkCopied || f.clientFound,
    },
  ];
}

// Shown until every step is done, or until the photographer hides it.
export function showSetupChecklist(steps: SetupStep[], dismissed: boolean): boolean {
  return !dismissed && steps.some((s) => !s.done);
}
