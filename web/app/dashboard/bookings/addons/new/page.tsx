import { addAddon } from "../../addon-actions";
import { AddonForm } from "../../addon-form";

export default function NewAddonPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-bold tracking-wider text-violet uppercase">Booking setup</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Add an add-on</h1>
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
