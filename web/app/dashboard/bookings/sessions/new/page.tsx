import { addSessionType } from "../../actions";
import { SessionTypeForm } from "../../session-type-form";

export default function NewSessionTypePage() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-bold tracking-wider text-violet uppercase">Booking setup</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Add a session</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <SessionTypeForm action={addSessionType} submitLabel="Add session" />
      </div>
    </div>
  );
}
