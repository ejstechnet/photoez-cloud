import { costReport, currentMonth } from "@/lib/ai/cost-report";
import { requireOwner } from "@/lib/owner";
import { csvCell } from "@/lib/signup-stats";

// The AI usage report's per-studio table as a spreadsheet (the owner only).
export async function GET(request: Request) {
  await requireOwner();
  const asked = new URL(request.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : currentMonth();
  const report = await costReport(month);
  const lines = [
    ["Month", "Studio", "Plan", "AI calls", "AI spend ($)", "List price per month ($)", "AI as % of price"].join(","),
    ...report.studios.map((s) =>
      [
        month,
        s.name,
        s.plan,
        String(s.calls),
        (s.microdollars / 1_000_000).toFixed(4),
        (s.listPriceCents / 100).toFixed(2),
        s.percentOfPrice === null ? "" : String(s.percentOfPrice),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="photoez-cloud-ai-usage-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
