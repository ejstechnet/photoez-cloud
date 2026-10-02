import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { LegalFooter } from "@/components/legal-page";
import { cleanSource } from "@/lib/leads";
import { QuizFlow } from "./quiz-flow";

export const metadata: Metadata = {
  title: "Find your fit in 60 seconds · PhotoEZ Cloud",
  description: "Four quick questions to see which tools PhotoEZ Cloud replaces for your photography business, and what you'd save.",
  openGraph: {
    title: "How much could your studio save?",
    description: "Four quick questions. See which tools PhotoEZ Cloud replaces and what you'd save each month.",
    images: ["/home/hero.webp"],
  },
};

// The landing-page quiz. Ads can link here directly as /quiz?src=<where>;
// the tag and the answers are saved with the sign-up.
export default async function QuizPage({ searchParams }: PageProps<"/quiz">) {
  const { src } = await searchParams;
  return (
    <div className="flex flex-1 flex-col overflow-x-hidden" style={{ backgroundColor: "#060f1e" }}>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5 text-white">
        <Logo />
        <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
          Log in
        </Link>
      </header>
      <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-16">
        <div className="pointer-events-none absolute -top-10 -right-24 size-80 rounded-full bg-violet/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-20 size-72 rounded-full bg-coral/15 blur-3xl" />
        <QuizFlow source={cleanSource(src)} />
      </main>
      <div className="bg-background">
        <LegalFooter />
      </div>
    </div>
  );
}
