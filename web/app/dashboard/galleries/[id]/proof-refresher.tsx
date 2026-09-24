"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadWatermark, makeProof, type WatermarkSettings } from "@/lib/proof-maker";
import { SparklesIcon } from "@/components/icons";
import { markProofsMade, prepareProofRefresh } from "../actions";

// Re-stamps the current watermark onto proofs that are missing or out of date,
// 20 photos at a time, entirely in the browser.
export function ProofRefresher({
  galleryId,
  watermark,
  staleCount,
}: {
  galleryId: string;
  watermark: WatermarkSettings;
  staleCount: number;
}) {
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setDone(0);
    try {
      const stamp = (await loadWatermark(watermark))!;
      for (;;) {
        const batch = await prepareProofRefresh(galleryId);
        if ("error" in batch) throw new Error(batch.error);
        if (batch.jobs.length === 0) break;

        const finished: string[] = [];
        for (const job of batch.jobs) {
          const preview = await createImageBitmap(await (await fetch(job.previewUrl)).blob());
          const proof = await makeProof(preview, stamp);
          preview.close();
          const upload = await fetch(job.proofUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: proof,
          });
          if (!upload.ok) throw new Error("A proof didn't upload. Try again.");
          finished.push(job.photoId);
          setDone((count) => count + 1);
        }
        const saved = await markProofsMade(galleryId, finished);
        if ("error" in saved) throw new Error(saved.error);
      }
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong. Try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-sun/50 bg-sun/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <span className="font-semibold">
          {staleCount} {staleCount === 1 ? "proof needs" : "proofs need"} your current watermark.
        </span>{" "}
        <span className="text-muted">Clients see the watermarked proofs while choosing favorites.</span>
        {error && <span className="mt-1 block font-medium text-danger">{error}</span>}
      </p>
      <button type="button" onClick={run} disabled={running} className="btn-primary shrink-0">
        <SparklesIcon size={18} />
        {running ? `Updating ${done} of ${staleCount}…` : "Update proofs"}
      </button>
    </div>
  );
}
