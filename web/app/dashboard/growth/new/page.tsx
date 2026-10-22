import Link from "next/link";
import { ensureGrowthSeeded, listSources } from "@/lib/growth/opportunities";
import { requireOwner } from "@/lib/owner";
import { PostForm } from "./post-form";

export const metadata = { title: "Add a post · Growth · PhotoEZ Cloud" };

export default async function NewPostPage() {
  await requireOwner();
  await ensureGrowthSeeded();
  const sources = await listSources();

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/growth" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Growth
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Add a post</h1>
      <p className="mt-2 text-muted">
        Paste a public post where a photographer is asking about studio software. Only save what anyone in that group could
        read.
      </p>
      <div className="card mt-8 p-6 sm:p-8">
        <PostForm sources={sources.filter((s) => s.enabled).map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </div>
  );
}
