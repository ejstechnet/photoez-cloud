import Link from "next/link";
import { Logo, PrintStack, WorkflowPills } from "@/components/brand";
import { ArrowRightIcon, ChatIcon, InboxIcon, SearchIcon, WandIcon } from "@/components/icons";

const features = [
  {
    title: "Inquiry triage",
    body: "New inquiries arrive sorted: session type, date, budget, and a reply drafted in your voice.",
    icon: <InboxIcon size={22} />,
    tile: "bg-coral",
  },
  {
    title: "Gallery search",
    body: "Type “first dance” or “shots with grandma” and find them in seconds.",
    icon: <SearchIcon size={22} />,
    tile: "bg-violet",
  },
  {
    title: "Culling help",
    body: "Blurry frames, closed eyes, and near-duplicates flagged before you deliver.",
    icon: <WandIcon size={22} />,
    tile: "bg-sun",
  },
  {
    title: "Studio assistant",
    body: "“Remind everyone whose gallery expires this week.” Done, after you approve it.",
    icon: <ChatIcon size={22} />,
    tile: "bg-lime",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-lime/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-coral/25 blur-3xl" />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Logo />
          <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
            Log in
          </Link>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 lg:grid-cols-[1.2fr_1fr] lg:pt-16">
          <div>
            <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">
              PhotoEZ, now in the cloud
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Studio software with a{" "}
              <span className="relative inline-block italic text-lime">
                creative streak
                <svg
                  className="absolute -bottom-2 left-0 w-full text-sun"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M2 9c40-6 80-8 120-5s60 3 76 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>
            <p className="mt-6 max-w-lg text-lg text-white/80">
              Galleries, clients, and delivery, with AI that reads your inquiries, finds your shots, and handles the
              busywork so you can get back behind the camera.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="btn-primary bg-lime text-brand-deep">
                Start your studio <ArrowRightIcon size={18} />
              </Link>
              <Link href="/login" className="btn-secondary border-white/30 bg-transparent text-white hover:border-lime">
                I have an account
              </Link>
            </div>
          </div>
          <PrintStack className="mx-auto hidden sm:block" />
        </div>

        <div className="relative border-t border-white/10 bg-brand-deep/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/70">Every client, from first hello to final delivery.</p>
            <WorkflowPills />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <p className="text-sm font-bold tracking-wider text-coral uppercase">The AI toolkit</p>
        <h2 className="mt-2 max-w-xl font-display text-4xl font-bold tracking-tight">
          Less admin. <span className="italic text-link">More art.</span>
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="card p-6 transition hover:-translate-y-1 hover:shadow-xl">
              <span className={`grid size-12 place-items-center rounded-2xl text-brand-deep ${feature.tile}`}>
                {feature.icon}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-border py-8 text-center text-sm text-muted">
        Built by Elle Jones · Part of the PhotoEZ family from EJS Tech
      </footer>
    </main>
  );
}
