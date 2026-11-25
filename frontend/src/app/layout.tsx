import type { Metadata } from "next";
import { DemoProvider } from "@/lib/demo-store";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RelayDesk · Customer support",
    template: "%s · RelayDesk",
  },
  description: "RelayDesk AI-assisted customer support and SLA management workspace.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
