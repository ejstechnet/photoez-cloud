// Watermark rules, matching PhotoEZ for WordPress (PhotoEZ_Watermark):
// the watermark is scaled to 55% of the photo's width, drawn at the chosen
// opacity, and placed in the center or a corner with a 40px margin, on a proof
// no larger than 2048px.

export const WATERMARK_POSITIONS = ["center", "top_left", "top_right", "bottom_left", "bottom_right"] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

export const POSITION_LABELS: Record<WatermarkPosition, string> = {
  center: "Center",
  top_left: "Top left",
  top_right: "Top right",
  bottom_left: "Bottom left",
  bottom_right: "Bottom right",
};

export const PROOF_MAX_EDGE = 2048;
export const WATERMARK_WIDTH_RATIO = 0.55;
export const WATERMARK_MARGIN = 40;
export const MAX_WATERMARK_BYTES = 5 * 1024 * 1024;

// Where to draw the watermark (natural size wmNaturalW × wmNaturalH) on an
// image of size imgW × imgH.
export function watermarkBox(
  imgW: number,
  imgH: number,
  wmNaturalW: number,
  wmNaturalH: number,
  position: WatermarkPosition,
) {
  const width = Math.max(1, Math.floor(imgW * WATERMARK_WIDTH_RATIO));
  const height = Math.max(1, Math.floor((wmNaturalH / wmNaturalW) * width));
  const m = WATERMARK_MARGIN;
  const spots: Record<WatermarkPosition, [number, number]> = {
    center: [Math.floor((imgW - width) / 2), Math.floor((imgH - height) / 2)],
    top_left: [m, m],
    top_right: [imgW - width - m, m],
    bottom_left: [m, imgH - height - m],
    bottom_right: [imgW - width - m, imgH - height - m],
  };
  const [x, y] = spots[position];
  return {
    x: Math.max(0, Math.min(imgW - width, x)),
    y: Math.max(0, Math.min(imgH - height, y)),
    width,
    height,
  };
}
