import Link from "next/link";
import { addSessionType } from "../../actions";
import { SessionTypeForm } from "../../session-type-form";

export default function NewSessionTypePage() {
  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings/setup" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to sessions
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Add a session</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <SessionTypeForm action={addSessionType} submitLabel="Add session" />
      </div>
    </div>
  );
}
