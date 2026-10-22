import { ensureGrowthSeeded, listSources } from "@/lib/growth/opportunities";
import { requireOwner } from "@/lib/owner";
import { CaptureForm } from "./capture-form";

export const metadata = { title: "Save a post · Growth · PhotoEZ Cloud" };

// Opened by the "Save to PhotoEZ Growth" bookmark in a small window
// (lib/growth/capture.ts). Not logged in? The login page comes first, then
// this page, and the bookmark still hands over the post.
export default async function CapturePage() {
  await requireOwner();
  await ensureGrowthSeeded();
  const sources = (await listSources()).filter((s) => s.enabled);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">Save a post</h1>
      <div className="card mt-6 p-6">
        <CaptureForm sources={sources.map((s) => ({ id: s.id, name: s.name, platform: s.platform }))} />
      </div>
    </div>
  );
}
