import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { Logo } from "@/components/brand";
import { LEGAL, LegalFooter } from "@/components/legal-page";
import { auth } from "@/lib/auth";
import { ContactForm } from "./contact-form";
import { GuideBrowser } from "./guide-browser";
import { CLIENT_TOPICS, PHOTOGRAPHER_TOPICS } from "./guides";

export const metadata: Metadata = {
  title: "Help & Support · PhotoEZ Cloud",
  alternates: { canonical: "/support" },
  description:
    "Step-by-step help for PhotoEZ Cloud: booking, galleries, contracts, invoices, and AI tools for photographers, plus help for their clients. Questions or a bug? Send us a message.",
};

// The public help page: how-to guides for photographers (the default) or for
// their clients (?for=clients), and a contact form for questions and bugs.
export default async function SupportPage({ searchParams }: PageProps<"/support">) {
  const forClients = (await searchParams).for === "clients";
  const topics = forClients ? CLIENT_TOPICS : PHOTOGRAPHER_TOPICS;

  // A logged-in photographer gets their details filled in on the form.
  const session = await auth.api.getSession({ headers: await headers() });
  let account: { name: string; email: string; studio: string } | null = null;
  if (session) {
    const [studio] = await db
      .select({ businessName: photographers.businessName })
      .from(photographers)
      .where(eq(photographers.id, session.user.id));
    account = { name: session.user.name, email: session.user.email, studio: studio?.businessName ?? "" };
  }

  const tab = (active: boolean) =>
    `rounded-full px-5 py-2.5 text-sm font-bold tracking-wider uppercase transition ${
      active ? "bg-lime text-brand-deep" : "text-white/80 hover:text-lime"
    }`;

  return (
    <div className="flex flex-1 flex-col">
      {/* Deep navy, like the home page. */}
      <header className="text-white" style={{ backgroundColor: "#060f1e" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <Logo />
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
              Home
            </Link>
            <Link
              href={session ? "/dashboard" : "/login"}
              className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime"
            >
              {session ? "Dashboard" : "Log in"}
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-14 text-center">
          <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">
            Help &amp; support
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-6xl">
            How can we help?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            {forClients
              ? "Booking a session, signing, paying, and getting your photos from a photographer who uses PhotoEZ Cloud."
              : "Step-by-step guides for running your studio on PhotoEZ Cloud."}{" "}
            Can&rsquo;t find it?{" "}
            <a href="#contact" className="font-semibold text-lime underline underline-offset-4">
              Send us a message
            </a>
            .
          </p>
          <nav aria-label="Who the guides are for" className="mt-8 inline-flex rounded-full bg-white/10 p-1">
            <Link href="/support" className={tab(!forClients)} aria-current={forClients ? undefined : "page"}>
              For photographers
            </Link>
            <Link href="/support?for=clients" className={tab(forClients)} aria-current={forClients ? "page" : undefined}>
              For clients
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        {/* Keyed so switching tabs clears the search. */}
        <GuideBrowser
          key={forClients ? "clients" : "photographers"}
          topics={topics}
          example={forClients ? "“download” or “reschedule”" : "“watermark” or “deposit”"}
        />

        <section id="contact" className="mt-20 scroll-mt-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Still need help?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">
              Ask a question, tell us what&rsquo;s not working, or report a bug. A real person reads every message. You can
              also email{" "}
              <a href={`mailto:${LEGAL.email}`} className="link">
                {LEGAL.email}
              </a>
              .
            </p>
          </div>
          <div className="card mx-auto mt-8 max-w-3xl p-6 sm:p-8">
            <ContactForm
              key={forClients ? "clients" : "photographers"}
              initialRole={forClients ? "client" : "photographer"}
              account={account}
            />
          </div>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
