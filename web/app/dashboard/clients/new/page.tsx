import { addClient } from "../actions";
import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">Add client</h1>
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <ClientForm action={addClient} submitLabel="Add client" />
      </div>
    </div>
  );
}
