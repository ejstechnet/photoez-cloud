// Tests for the Page Designer's rules.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_DESIGN,
  THEMES,
  bannerBackground,
  cleanDesign,
  contrast,
  designVars,
  fontsUrl,
  readableOnWhite,
  textOn,
} from "./design.ts";

test("an empty or broken design falls back to today's look", () => {
  assert.deepEqual(cleanDesign(null), DEFAULT_DESIGN);
  assert.deepEqual(cleanDesign({ main: "red; position:fixed", headingFont: "Comic Sans", corners: "wavy" }), DEFAULT_DESIGN);
});

test("a light main color is darkened so white text stays readable", () => {
  const design = cleanDesign({ main: "#ffe4ec" });
  assert.ok(contrast(design.main, "#ffffff") >= 4.5);
});

test("accent text color and readable-on-white shade", () => {
  assert.equal(textOn("#46c12f"), "#111111");
  assert.equal(textOn("#111111"), "#ffffff");
  assert.ok(contrast(readableOnWhite("#f2f2f2"), "#ffffff") >= 4.5);
});

test("design variables drive colors, fonts, and corners", () => {
  const vars = designVars(cleanDesign({ ...DEFAULT_DESIGN, headingFont: "Playfair Display", corners: "square" }));
  assert.equal(vars["--font-young-serif"], "'Playfair Display', serif");
  assert.equal(vars["--radius-3xl"], "0.25rem");
  assert.equal(designVars(DEFAULT_DESIGN)["--radius-3xl"], undefined);
});

test("fonts load only when they aren't the built-in ones", () => {
  assert.equal(fontsUrl(DEFAULT_DESIGN), null);
  assert.match(fontsUrl(cleanDesign({ headingFont: "Fraunces", bodyFont: "Inter" }))!, /family=Fraunces.*family=Inter/);
});

test("banner backgrounds", () => {
  assert.equal(bannerBackground(DEFAULT_DESIGN), "#000000");
  assert.match(bannerBackground(cleanDesign({ banner: "gradient", bannerColor: "#111111", bannerColor2: "#222222" })), /linear-gradient/);
});

test("every theme is a valid design", () => {
  for (const theme of THEMES) {
    const cleaned = cleanDesign({ ...theme.design });
    assert.equal(cleaned.headingFont, theme.design.headingFont, theme.name);
    assert.equal(cleaned.bodyFont, theme.design.bodyFont, theme.name);
  }
});
