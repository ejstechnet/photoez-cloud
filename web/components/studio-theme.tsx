import { cleanDesign, designVars, fontsUrl, type Design } from "@/lib/design";

// Wraps a studio's public pages in its Page Designer look: colors, fonts, and
// corners are CSS variables the whole page reads (see globals.css), and the
// chosen Google Fonts load here.
export function StudioTheme({ design, children }: { design: Partial<Design> | null | undefined; children: React.ReactNode }) {
  const clean = cleanDesign(design);
  const fonts = fontsUrl(clean);
  return (
    <div data-corners={clean.corners} style={designVars(clean) as React.CSSProperties} className="flex flex-1 flex-col font-sans">
      {fonts && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fonts} precedence="default" />
        </>
      )}
      {children}
    </div>
  );
}
