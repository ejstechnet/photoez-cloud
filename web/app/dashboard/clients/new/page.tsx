import { addClient } from "../actions";
import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Clients</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Add a client</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <ClientForm action={addClient} submitLabel="Add client" />
      </div>
    </div>
  );
}
