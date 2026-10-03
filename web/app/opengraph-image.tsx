import { ImageResponse } from "next/og";
import { ShareCard, shareSize } from "@/lib/share-card";

// The share picture for photoezcloud.com links (pages without their own).
export const alt = "PhotoEZ Cloud: studio software for photographers";
export const size = shareSize;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    await ShareCard({
      kicker: "Studio software for photographers",
      title: "Booking to delivery, in one place",
      line: "Contracts · galleries · invoices · payments · print store · AI help",
    }),
    size,
  );
}
