import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Validate",
  description: "Validate product assumptions with live customer interviews, backed by quotes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <body suppressHydrationWarning className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
