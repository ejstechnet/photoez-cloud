import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { signedViewUrl } from "@/lib/storage";
import { StudioForm } from "./studio-form";
import { StudioLogo } from "./studio-logo";
import { WatermarkForm } from "./watermark-form";

export default async function SettingsPage() {
  const user = await requirePhotographer();
  const [settings] = await db
    .select({
      key: photographers.watermarkKey,
      opacity: photographers.watermarkOpacity,
      position: photographers.watermarkPosition,
      businessName: photographers.businessName,
      studioSlug: photographers.studioSlug,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
      studioTagline: photographers.studioTagline,
      studioBio: photographers.studioBio,
      serviceArea: photographers.serviceArea,
      offeredTypes: photographers.offeredTypes,
      shootLocations: photographers.shootLocations,
      quoteOnlyTypes: photographers.quoteOnlyTypes,
    })
    .from(photographers)
    .where(eq(photographers.id, user.id));

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold tracking-wider text-sky uppercase">Studio settings</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Settings</h1>

      <section id="studio" className="card mt-8 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">Studio profile</h2>
        <p className="mt-1 text-sm text-muted">
          Your public studio page, where clients send inquiries and quote requests that land in Inquiries, already
          triaged.
        </p>
        <div className="mt-6">
          <StudioLogo
            currentUrl={settings.logoKey ? await signedViewUrl(settings.logoKey) : null}
            background={settings.logoBg}
          />
        </div>
        <div className="mt-6 border-t border-border pt-6">
          <StudioForm
            siteUrl={siteUrl}
            profile={{
              businessName: settings.businessName ?? user.name,
              studioSlug: settings.studioSlug ?? "",
              studioTagline: settings.studioTagline ?? "",
              studioBio: settings.studioBio ?? "",
              serviceArea: settings.serviceArea ?? "",
              offeredTypes: settings.offeredTypes,
              shootLocations: settings.shootLocations,
              quoteOnlyTypes: settings.quoteOnlyTypes,
            }}
          />
        </div>
      </section>

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
