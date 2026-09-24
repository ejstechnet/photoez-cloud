"use client";

import { useTransition } from "react";
import Link from "next/link";
import { SparklesIcon, UsersIcon } from "@/components/icons";
import { convertToClient, retriageInquiry, setInquiryStatus } from "../actions";

// Next steps for an inquiry: turn it into a client, mark it replied or
// archived, or run the AI triage again.
export function InquiryActions({
  inquiryId,
  status,
  clientId,
  hasTriage,
}: {
  inquiryId: string;
  status: "new" | "replied" | "converted" | "archived";
  clientId: string | null;
  hasTriage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<void>) => startTransition(action);

  return (
    <div className="flex flex-wrap gap-2">
      {clientId ? (
        <Link href={`/dashboard/clients/${clientId}`} className="btn-primary">
          <UsersIcon size={18} /> View client
        </Link>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => convertToClient(inquiryId))} className="btn-primary">
          <UsersIcon size={18} /> Create client
        </button>
      )}
      {status === "new" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setInquiryStatus(inquiryId, "replied"))}
          className="btn-secondary"
        >
          Mark replied
        </button>
      )}
      {status !== "archived" && status !== "converted" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setInquiryStatus(inquiryId, "archived"))}
          className="btn-secondary"
        >
          Archive
        </button>
      )}
      {status === "archived" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setInquiryStatus(inquiryId, "new"))}
          className="btn-secondary"
        >
          Restore
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          (!hasTriage || confirm("Run the AI triage again? The current results and draft will be replaced.")) &&
          run(() => retriageInquiry(inquiryId))
        }
        className="btn-secondary"
      >
        <SparklesIcon size={16} /> {pending ? "Working…" : hasTriage ? "Re-run triage" : "Run triage"}
      </button>
    </div>
  );
}
