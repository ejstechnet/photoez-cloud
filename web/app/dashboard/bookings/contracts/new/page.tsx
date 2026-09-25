import Link from "next/link";
import { addContract } from "../../contract-actions";
import { ContractForm } from "../../contract-form";

export default function NewContractPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/bookings/setup#contracts" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to contracts
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">New contract</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <ContractForm action={addContract} submitLabel="Save contract" />
      </div>
    </div>
  );
}
