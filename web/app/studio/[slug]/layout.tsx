import { StudioTheme } from "@/components/studio-theme";
import { designForSlug } from "@/lib/studio-design";

// Every page under here wears the studio's Page Designer look.
export default async function Layout({ children, params }: LayoutProps<"/studio/[slug]">) {
  const { slug } = await params;
  return <StudioTheme design={await designForSlug(slug)}>{children}</StudioTheme>;
}
