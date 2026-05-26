import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "MadeFit Media Automation",
  description: "Automated MadeFit Instagram media distribution to Google Business Profile and website gallery.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Unregister any stale service workers to prevent chunk-load errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); }); }`
          }}
        />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
