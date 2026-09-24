import Link from "next/link";

// Shared frame for the sign-up and login pages.
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-sm font-semibold tracking-wide text-brand">
          PhotoEZ Cloud
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
