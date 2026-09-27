import { StudioTheme } from "@/components/studio-theme";
import { designForBookingToken } from "@/lib/studio-design";

// Every page under here wears the studio's Page Designer look.
export default async function Layout({ children, params }: LayoutProps<"/booking/[token]">) {
  const { token } = await params;
  return <StudioTheme design={await designForBookingToken(token)}>{children}</StudioTheme>;
}
