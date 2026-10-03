import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The picture shown when a PhotoEZ Cloud link is shared (Facebook, texts,
// Slack): navy, the PhotoEZ Cloud mark, a big title, and a lime line. Used by
// app/opengraph-image.tsx and each studio's app/studio/[slug]/opengraph-image.tsx.

export const shareSize = { width: 1200, height: 630 };

let markCache: string | null = null;
async function mark() {
  markCache ??= `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), "app", "icon.svg"))).toString("base64")}`;
  return markCache;
}

export async function ShareCard({ kicker, title, line }: { kicker: string; title: string; line: string }) {
  const logo = await mark();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(135deg, #0f2548 0%, #1a3a6b 70%, #1e7ce0 140%)",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={120} height={84} alt="" />
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700 }}>
          <span>Photo</span>
          <span style={{ color: "#46c12f", marginLeft: -2 }}>EZ</span>
          <span style={{ marginLeft: 16, fontSize: 26, letterSpacing: 8, opacity: 0.8 }}>CLOUD</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 26, letterSpacing: 4, color: "#46c12f", textTransform: "uppercase", fontWeight: 700 }}>{kicker}</div>
        <div style={{ fontSize: title.length > 40 ? 58 : 72, fontWeight: 700, lineHeight: 1.08, maxWidth: 1000 }}>{title}</div>
        <div style={{ fontSize: 30, opacity: 0.85, maxWidth: 1000 }}>{line}</div>
      </div>
      <div style={{ height: 10, width: 220, borderRadius: 5, background: "#46c12f" }} />
    </div>
  );
}
