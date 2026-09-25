import Link from "next/link";
import { addAddon } from "../../addon-actions";
import { AddonForm } from "../../addon-form";

export default function NewAddonPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings/setup#addons" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to add-ons
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Add an add-on</h1>
      <p className="mt-2 text-muted">
        Extras clients can add when they book, like more edited photos or prints. After saving, add a photo and choose
        which sessions offer it.
      </p>
      <div className="card mt-8 p-6 sm:p-8">
        <AddonForm action={addAddon} submitLabel="Add add-on" />
      </div>
    </div>
  );
}
