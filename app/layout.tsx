import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppProgress } from "@/components/ui/app-progress";
import { ToastHost } from "@/components/ui/toast-host";

export const metadata: Metadata = {
  title: "Crossval — Pricing documents",
  description: "A calm workspace for pricing documents and proposals.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToastHost />
        <Suspense fallback={null}>
          <AppProgress />
        </Suspense>
      </body>
    </html>
  );
}
