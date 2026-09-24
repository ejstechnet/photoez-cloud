import { downloadZip } from "client-zip";
import { clientFinals, findGalleryByToken, isDelivered } from "@/lib/client-gallery";
import { uniqueFileNames } from "@/lib/format";
import { photoKey, signedViewUrl } from "@/lib/storage";

// "Download all": streams every final original from R2 into one ZIP as the
// client downloads it. Nothing is built ahead of time or held in memory, so a
// multi-gigabyte wedding gallery works the same as a small one. Photos are
// already compressed, so the ZIP stores them as-is.
export async function GET(_request: Request, { params }: RouteContext<"/g/[token]/download">) {
  const { token } = await params;
  const gallery = await findGalleryByToken(token);
  if (!gallery || !isDelivered(gallery)) return new Response("Not found", { status: 404 });

  const finals = await clientFinals(gallery);
  if (finals.length === 0) return new Response("Not found", { status: 404 });
  const names = uniqueFileNames(finals.map((photo) => photo.originalName));

  async function* files() {
    for (const [i, photo] of finals.entries()) {
      // Fetched one at a time, just before it's added to the ZIP.
      const response = await fetch(await signedViewUrl(photoKey(photo.fileKey, "original")));
      if (!response.ok) throw new Error(`Couldn't read ${photo.originalName} from storage`);
      yield { name: names[i], input: response, lastModified: photo.createdAt };
    }
  }

  // With every file's exact size known, the browser can show real progress.
  const sizesKnown = finals.every((photo) => photo.sizeBytes !== null);
  const zip = downloadZip(
    files(),
    sizesKnown ? { metadata: finals.map((photo, i) => ({ name: names[i], size: photo.sizeBytes! })) } : undefined,
  );

  const filename = `${gallery.title.replace(/[^\w\- ]+/g, "").trim() || "photos"}.zip`;
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  });
  const length = zip.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);
  return new Response(zip.body, { headers });
}
