// The top menu bar on a studio's public pages takes the color the
// photographer picked for behind their logo, so the logo sits right on the
// bar with no box around it. "transparent" means a logo made for dark
// backgrounds, so the bar stays PhotoEZ navy.

const NAVY = "#0f2548";

export function studioBarColor(logoBg: string) {
  return /^#[0-9a-f]{6}$/i.test(logoBg) ? logoBg : NAVY;
}

// True when white text reads better than dark text on this color.
export function isDarkColor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}
