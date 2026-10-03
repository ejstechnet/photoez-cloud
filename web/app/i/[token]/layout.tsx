import { StudioTheme } from "@/components/studio-theme";
import { designForInvoiceToken } from "@/lib/studio-design";

// Every page under here wears the studio's Page Designer look.
export default async function Layout({ children, params }: LayoutProps<"/i/[token]">) {
  const { token } = await params;
  return <StudioTheme design={await designForInvoiceToken(token)}>{children}</StudioTheme>;
}
