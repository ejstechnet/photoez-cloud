import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { Logo } from "@/components/brand";
import { LegalFooter } from "@/components/legal-page";
import { studioFromUnsubscribeToken } from "@/lib/unsubscribe";
import { setUnsubscribed } from "./actions";

export const metadata: Metadata = { title: "Email preferences · PhotoEZ Cloud", robots: { index: false } };

// Where the unsubscribe link in the owner's emails to studios leads. It asks
// before unsubscribing, so a mail scanner opening the link changes nothing.
export default async function UnsubscribePage({ params }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  const studioId = studioFromUnsubscribeToken(token);
  const [studio] = studioId
    ? await db
        .select({ email: photographers.email, optedOutAt: photographers.marketingOptOutAt })
        .from(photographers)
        .where(eq(photographers.id, studioId))
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="text-white" style={{ backgroundColor: "#060f1e" }}>
        <div className="mx-auto flex max-w-7xl items-center px-4 py-5">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
        <div className="card p-8 text-center">
          {!studio ? (
            <>
              <h1 className="font-display text-3xl font-bold">This link doesn&rsquo;t work</h1>
              <p className="mt-3 text-muted">
                It may have been copied incompletely. Use the unsubscribe link in the email itself, or reply to the email
                and we&rsquo;ll take care of it.
              </p>
            </>
          ) : studio.optedOutAt ? (
            <>
              <h1 className="font-display text-3xl font-bold">You&rsquo;re unsubscribed</h1>
              <p className="mt-3 text-muted">
                {studio.email} won&rsquo;t get PhotoEZ Cloud updates and announcements anymore. Emails about your account,
                like receipts and password resets, still come through.
              </p>
              <form action={setUnsubscribed.bind(null, token, false)} className="mt-6">
                <button type="submit" className="btn-secondary">
                  Changed my mind: resubscribe
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold">Unsubscribe from updates?</h1>
              <p className="mt-3 text-muted">
                {studio.email} will stop getting PhotoEZ Cloud updates and announcements. Emails about your account, like
                receipts and password resets, still come through.
              </p>
              <form action={setUnsubscribed.bind(null, token, true)} className="mt-6">
                <button type="submit" className="btn-primary">
                  Unsubscribe
                </button>
              </form>
            </>
          )}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
