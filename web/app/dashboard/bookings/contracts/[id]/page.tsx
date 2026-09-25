import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { contractTemplates } from "@/db/schema";
import { richTextHtml } from "@/lib/rich-text";
import { requirePhotographer } from "@/lib/session";
import { ConfirmButton } from "../../confirm-button";
import { deleteContract, updateContract } from "../../contract-actions";
import { ContractForm } from "../../contract-form";

export default async function EditContractPage({ params, searchParams }: PageProps<"/dashboard/bookings/contracts/[id]">) {
  const { id } = await params;
  const { added } = await searchParams;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [contract] = await db
    .select()
    .from(contractTemplates)
    .where(and(eq(contractTemplates.id, id), eq(contractTemplates.photographerId, user.id)));
  if (!contract) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/bookings/setup#contracts" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to contracts
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight break-words">{contract.title}</h1>
      {added === "1" && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Here&apos;s the PhotoEZ starter contract. Read it over, make it yours, and save.
        </p>
      )}
      <div className="card mt-8 p-6 sm:p-8">
        <ContractForm
          action={updateContract.bind(null, contract.id)}
          defaultValues={{ ...contract, content: richTextHtml(contract.content) }}
          submitLabel="Save contract"
        />
      </div>
      <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Delete this contract</p>
          <p className="text-sm text-muted">Contracts clients already signed are kept.</p>
        </div>
        <ConfirmButton
          action={deleteContract.bind(null, contract.id)}
          confirmText={`Delete ${contract.title}? This can't be undone.`}
          pendingLabel="Deleting…"
          danger
        >
          Delete contract
        </ConfirmButton>
      </div>
    </div>
  );
}
