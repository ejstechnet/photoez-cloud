import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { textingOn } from "@/lib/sms/send";
import { signedViewUrl } from "@/lib/storage";
import { studioLinks } from "@/lib/studio-links";
import { StudioFooter } from "../studio-bar";
import { StudioNav } from "../studio-nav";
import { TextSignupForm } from "./signup-form";

async function findStudio(slug: string) {
  const [studio] = await db.select().from(photographers).where(eq(photographers.studioSlug, slug.toLowerCase()));
  return studio ?? null;
}

export async function generateMetadata({ params }: PageProps<"/studio/[slug]/texts">): Promise<Metadata> {
  const studio = await findStudio((await params).slug);
  return { title: studio ? `Text reminders · ${studio.businessName || studio.name}` : "Studio not found · PhotoEZ Cloud" };
}

// A public sign-up for a studio's text reminders: the same opt-in checkbox and
// wording as the booking form, on its own page, so clients (and the carriers
// reviewing the studio's texting registration) can see the consent step
// without booking. Shown only while the studio texts.
export default async function TextSignupPage({ params }: PageProps<"/studio/[slug]/texts">) {
  const slug = (await params).slug.toLowerCase();
  const studio = await findStudio(slug);
  if (!studio || !(await textingOn(studio.id))) notFound();
  const name = studio.businessName || studio.name;
  const logoUrl = studio.studioLogoKey ? await signedViewUrl(studio.studioLogoKey) : null;

  return (
    <div className="flex flex-1 flex-col">
      <StudioNav slug={slug} name={name} logoUrl={logoUrl} logoBg={studio.studioLogoBg} links={await studioLinks(slug)} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
        <h1 className="font-display text-4xl font-bold tracking-tight">Text reminders</h1>
        <p className="mt-3 text-muted">
          Get texts from {name} about your session and photos: session reminders, payment reminders, and when your gallery
          is ready or closing soon. No marketing texts. You can also sign up with the same checkbox when you book.
        </p>
        <div className="card mt-8 p-6 sm:p-8">
          <TextSignupForm slug={slug} studioName={name} />
        </div>
      </main>
      <StudioFooter studioId={studio.id} />
    </div>
  );
}
