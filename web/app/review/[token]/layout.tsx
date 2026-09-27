import { StudioTheme } from "@/components/studio-theme";
import { designForReviewToken } from "@/lib/studio-design";

// Every page under here wears the studio's Page Designer look.
export default async function Layout({ children, params }: LayoutProps<"/review/[token]">) {
  const { token } = await params;
  return <StudioTheme design={await designForReviewToken(token)}>{children}</StudioTheme>;
}
