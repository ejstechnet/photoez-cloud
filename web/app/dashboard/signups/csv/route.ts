import { requireOwner } from "@/lib/owner";
import { csvCell } from "@/lib/signup-stats";
import { trackedSignups } from "@/lib/signups";
import { describeAnswers } from "@/lib/quiz";

// Sign-ups as a spreadsheet (the owner only).
export async function GET() {
  await requireOwner();
  const rows = await trackedSignups();
  const lines = [
    ["Signed up", "Email", "Name", "Business", "Tag", "Now", "Quiz answers"].join(","),
    ...rows.map((r) =>
      [r.createdAt.toISOString().slice(0, 10), r.email, r.name ?? "", r.businessName ?? "", r.source ?? "", r.status, r.quiz ? describeAnswers(r.quiz) : ""]
        .map(csvCell)
        .join(","),
    ),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="photoez-cloud-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
