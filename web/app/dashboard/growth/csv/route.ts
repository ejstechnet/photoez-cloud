import { listOpportunities, recordExport } from "@/lib/growth/opportunities";
import { STATUS_LABELS } from "@/lib/growth/pipeline";
import { csvCell } from "@/lib/signup-stats";
import { requireOwner } from "@/lib/owner";

// Every saved Growth post as a spreadsheet (the owner only). Exports are
// recorded, since the file holds what people wrote.
export async function GET() {
  await requireOwner();
  const rows = await listOpportunities({ status: "all" });
  await recordExport(rows.length);
  const lines = [
    ["Saved", "Status", "Score", "Priority", "Platform", "Source", "Name shown", "Title", "Text", "Link", "Follow up"].join(","),
    ...rows.map((r) =>
      [
        r.discoveredAt.toISOString().slice(0, 10),
        STATUS_LABELS[r.status],
        r.score === null ? "" : String(r.score),
        r.tier ?? "",
        r.platform,
        r.sourceName ?? "",
        r.authorLabel ?? "",
        r.title ?? "",
        r.excerpt ?? "",
        r.url,
        r.nextActionAt ? r.nextActionAt.toISOString().slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="photoez-growth-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
