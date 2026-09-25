import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { triageInquiry } from "@/lib/ai/triage";

// Run AI triage on a saved inquiry and store the result, or the error, so an
// inquiry is never lost just because the AI step failed. Used by both the
// photographer's "New inquiry" form and the public studio page form.
export async function runTriage(
  inquiry: { id: string; message: string; fromName: string | null; fromEmail: string | null },
  photographer: { name: string; businessName?: string | null },
) {
  try {
    const run = await triageInquiry({
      message: inquiry.message,
      fromName: inquiry.fromName,
      fromEmail: inquiry.fromEmail,
      photographerName: photographer.name,
      studioName: photographer.businessName ?? null,
      today: new Date(),
    });
    await db
      .update(inquiries)
      .set({
        triage: run.result,
        triageError: null,
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        triagedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiry.id));
  } catch (error) {
    console.error("Inquiry triage failed", error);
    await db
      .update(inquiries)
      .set({
        triageError:
          error instanceof Error && error.message.startsWith("The AI")
            ? error.message
            : "The AI couldn't read this inquiry right now. Try again in a minute.",
      })
      .where(eq(inquiries.id, inquiry.id));
  }
}
