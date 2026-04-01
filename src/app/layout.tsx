import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "light",
  description: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <TooltipProvider>
            {children}
            <Analytics />
            <SpeedInsights />
          </TooltipProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
