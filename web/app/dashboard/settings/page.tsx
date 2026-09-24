import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { signedViewUrl } from "@/lib/storage";
import { WatermarkForm } from "./watermark-form";

export default async function SettingsPage() {
  const user = await requirePhotographer();
  const [settings] = await db
    .select({
      key: photographers.watermarkKey,
      opacity: photographers.watermarkOpacity,
      position: photographers.watermarkPosition,
    })
    .from(photographers)
    .where(eq(photographers.id, user.id));

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold tracking-wider text-sky uppercase">Studio settings</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Settings</h1>

      <section className="card mt-8 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">Proof watermark</h2>
        <p className="mt-1 text-sm text-muted">
          Stamped on every proof your clients see while they choose favorites. Final downloads are always clean.
        </p>
        <div className="mt-6">
          <WatermarkForm
            currentUrl={settings.key ? await signedViewUrl(settings.key) : null}
            opacity={settings.opacity}
            position={settings.position}
          />
        </div>
      </section>
    </div>
  );
}
