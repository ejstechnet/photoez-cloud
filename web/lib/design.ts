// The Page Designer: a studio's colors, fonts, corners, banner, and gallery
// layout, applied to every page its clients see (studio page, booking, gift
// cards, reviews, galleries). Pure logic, tested in design.test.ts.

export const CORNERS = ["rounded", "soft", "square"] as const;
export const BANNERS = ["solid", "gradient", "photo"] as const;
export const GALLERY_LAYOUTS = ["masonry", "grid", "large"] as const;

export type Design = {
  // Panels and dark sections (white text sits on it, so it must be dark).
  main: string;
  // Buttons and highlights.
  accent: string;
  headingFont: HeadingFont;
  bodyFont: BodyFont;
  corners: (typeof CORNERS)[number];
  banner: (typeof BANNERS)[number];
  // Banner colors: solid uses the first, gradient goes from the first to the second.
  bannerColor: string;
  bannerColor2: string;
  // Storage key of the banner photo (banner "photo").
  bannerImageKey: string | null;
  galleryLayout: (typeof GALLERY_LAYOUTS)[number];
};

// Curated Google Fonts. The first of each is PhotoEZ Cloud's own (already
// loaded by the app, so no extra download).
export const HEADING_FONTS = {
  "Young Serif": { css: "var(--font-young-serif)", google: null },
  "Playfair Display": { css: "'Playfair Display', serif", google: "Playfair+Display:wght@400;700" },
  "Cormorant Garamond": { css: "'Cormorant Garamond', serif", google: "Cormorant+Garamond:wght@500;700" },
  "DM Serif Display": { css: "'DM Serif Display', serif", google: "DM+Serif+Display" },
  Fraunces: { css: "'Fraunces', serif", google: "Fraunces:wght@400;700" },
  Montserrat: { css: "'Montserrat', sans-serif", google: "Montserrat:wght@500;700" },
  Poppins: { css: "'Poppins', sans-serif", google: "Poppins:wght@500;700" },
  "Josefin Sans": { css: "'Josefin Sans', sans-serif", google: "Josefin+Sans:wght@400;700" },
  Italiana: { css: "'Italiana', serif", google: "Italiana" },
} as const;
export type HeadingFont = keyof typeof HEADING_FONTS;

export const BODY_FONTS = {
  "Plus Jakarta Sans": { css: "var(--font-jakarta)", google: null },
  Inter: { css: "'Inter', sans-serif", google: "Inter:wght@400;600;700" },
  Lato: { css: "'Lato', sans-serif", google: "Lato:wght@400;700" },
  "Nunito Sans": { css: "'Nunito Sans', sans-serif", google: "Nunito+Sans:wght@400;600;700" },
  "Source Sans 3": { css: "'Source Sans 3', sans-serif", google: "Source+Sans+3:wght@400;600;700" },
  Karla: { css: "'Karla', sans-serif", google: "Karla:wght@400;600;700" },
  Raleway: { css: "'Raleway', sans-serif", google: "Raleway:wght@400;600;700" },
  Lora: { css: "'Lora', serif", google: "Lora:wght@400;600;700" },
} as const;
export type BodyFont = keyof typeof BODY_FONTS;

// Today's PhotoEZ Cloud look: navy and lime, black banner.
export const DEFAULT_DESIGN: Design = {
  main: "#0f2548",
  accent: "#46c12f",
  headingFont: "Young Serif",
  bodyFont: "Plus Jakarta Sans",
  corners: "rounded",
  banner: "solid",
  bannerColor: "#000000",
  bannerColor2: "#0f2548",
  bannerImageKey: null,
  galleryLayout: "masonry",
};

// Ready-made starting points; everything can be changed after picking one.
export const THEMES: { name: string; design: Omit<Design, "bannerImageKey" | "galleryLayout"> }[] = [
  { name: "PhotoEZ Classic", design: { ...DEFAULT_DESIGN } },
  {
    name: "Midnight Gold",
    design: { main: "#111111", accent: "#d4a843", headingFont: "Playfair Display", bodyFont: "Lato", corners: "soft", banner: "solid", bannerColor: "#000000", bannerColor2: "#2a2a2a" },
  },
  {
    name: "Blush",
    design: { main: "#5b3a44", accent: "#e8a0a8", headingFont: "Cormorant Garamond", bodyFont: "Nunito Sans", corners: "rounded", banner: "gradient", bannerColor: "#5b3a44", bannerColor2: "#a86a78" },
  },
  {
    name: "Sage & Clay",
    design: { main: "#2f4a3a", accent: "#d08a5b", headingFont: "Fraunces", bodyFont: "Karla", corners: "soft", banner: "solid", bannerColor: "#2f4a3a", bannerColor2: "#4d6b58" },
  },
  {
    name: "Ocean",
    design: { main: "#0b3c49", accent: "#2ec4b6", headingFont: "Montserrat", bodyFont: "Inter", corners: "rounded", banner: "gradient", bannerColor: "#0b3c49", bannerColor2: "#1b7a8c" },
  },
  {
    name: "Modern Mono",
    design: { main: "#1a1a1a", accent: "#f2f2f2", headingFont: "Josefin Sans", bodyFont: "Inter", corners: "square", banner: "solid", bannerColor: "#000000", bannerColor2: "#333333" },
  },
];

// ---- Colors ----

const HEX = /^#[0-9a-f]{6}$/i;

function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function toHex([r, g, b]: number[]) {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Mixes a color toward black (amount 0..1).
export function darken(hex: string, amount: number) {
  return toHex(rgb(hex).map((c) => c * (1 - amount)));
}

// The color darkened just enough to read as text on white (contrast 4.5).
export function readableOnWhite(hex: string) {
  let color = hex;
  for (let i = 0; i < 20 && contrast(color, "#ffffff") < 4.5; i++) color = darken(color, 0.1);
  return color;
}

// Black or white text, whichever reads better on the color.
export function textOn(hex: string) {
  return contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111";
}

// ---- Checking a design ----

// Fills gaps with the defaults and rejects anything odd, so a stored design
// (or a form post) can always be used safely in CSS.
export function cleanDesign(input: unknown): Design {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback);
  const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T) =>
    options.includes(v as T) ? (v as T) : fallback;
  let main = color(d.main, DEFAULT_DESIGN.main);
  // White text sits on the main color, so a light pick is darkened until it reads.
  for (let i = 0; i < 20 && contrast(main, "#ffffff") < 4.5; i++) main = darken(main, 0.1);
  return {
    main,
    accent: color(d.accent, DEFAULT_DESIGN.accent),
    headingFont: pick(d.headingFont, Object.keys(HEADING_FONTS) as HeadingFont[], DEFAULT_DESIGN.headingFont),
    bodyFont: pick(d.bodyFont, Object.keys(BODY_FONTS) as BodyFont[], DEFAULT_DESIGN.bodyFont),
    corners: pick(d.corners, CORNERS, DEFAULT_DESIGN.corners),
    banner: pick(d.banner, BANNERS, DEFAULT_DESIGN.banner),
    bannerColor: color(d.bannerColor, DEFAULT_DESIGN.bannerColor),
    bannerColor2: color(d.bannerColor2, DEFAULT_DESIGN.bannerColor2),
    bannerImageKey: typeof d.bannerImageKey === "string" && d.bannerImageKey.length < 300 ? d.bannerImageKey : null,
    galleryLayout: pick(d.galleryLayout, GALLERY_LAYOUTS, DEFAULT_DESIGN.galleryLayout),
  };
}

// ---- Applying a design ----

const RADII = {
  rounded: null,
  soft: { xl: "0.5rem", "2xl": "0.625rem", "3xl": "0.75rem" },
  square: { xl: "0.125rem", "2xl": "0.1875rem", "3xl": "0.25rem" },
} as const;

// CSS custom properties that restyle a page's descendants (the site's
// colors and fonts are all read from these; see globals.css).
export function designVars(design: Design): Record<string, string> {
  const vars: Record<string, string> = {
    "--brand": design.main,
    "--brand-deep": darken(design.main, 0.25),
    "--primary": design.main,
    "--primary-foreground": textOn(design.main),
    "--lime": design.accent,
    "--lime-ink": readableOnWhite(design.accent),
    "--on-accent": textOn(design.accent),
    "--link": readableOnWhite(design.main),
    "--font-young-serif": HEADING_FONTS[design.headingFont].css,
    "--font-jakarta": BODY_FONTS[design.bodyFont].css,
  };
  const radii = RADII[design.corners];
  if (radii) {
    vars["--radius-xl"] = radii.xl;
    vars["--radius-2xl"] = radii["2xl"];
    vars["--radius-3xl"] = radii["3xl"];
  }
  return vars;
}

// The Google Fonts stylesheet for the chosen fonts, or null for the defaults.
export function fontsUrl(design: Design) {
  const families: string[] = [];
  for (const family of [HEADING_FONTS[design.headingFont].google, BODY_FONTS[design.bodyFont].google]) {
    if (family) families.push(family);
  }
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${[...new Set(families)].map((f) => `family=${f}`).join("&")}&display=swap`;
}

// The banner's background (photo banners add the photo on top of this).
export function bannerBackground(design: Design) {
  return design.banner === "gradient"
    ? `linear-gradient(135deg, ${design.bannerColor}, ${design.bannerColor2})`
    : design.bannerColor;
}
