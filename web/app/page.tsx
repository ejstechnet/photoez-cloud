import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold tracking-wide text-brand">PhotoEZ Cloud</p>
      <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Studio software that does the busywork.
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        Client galleries, inquiries, and delivery prep, with AI that reads, sorts, and finds for you.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-brand-foreground hover:opacity-90"
        >
          Create an account
        </Link>
        <Link href="/login" className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-surface">
          Log in
        </Link>
      </div>
    </main>
  );
}
