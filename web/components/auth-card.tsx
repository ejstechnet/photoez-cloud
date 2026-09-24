import { Logo, PrintStack } from "./brand";

// Split-screen frame for sign-up and login: a navy PhotoEZ panel with the
// print stack on the left (large screens), the form on the right.
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
    <main className="grid flex-1 lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-20 bottom-10 size-80 rounded-full bg-violet/30 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-20 size-72 rounded-full bg-lime/20 blur-3xl" />
        <Logo />
        <div className="relative my-auto">
          <PrintStack className="mx-auto" />
          <p className="mx-auto mt-12 max-w-sm text-center font-display text-2xl italic">
            “Deliver the gallery. Let the AI handle the paperwork.”
          </p>
        </div>
      </aside>

      <div className="flex flex-col">
        <div className="bg-brand px-4 py-4 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
