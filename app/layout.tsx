import type { Metadata } from "next";
import "./globals.css";
import { ToastHost } from "@/components/ui/toast-host";

export const metadata: Metadata = {
  title: "Crossval — Pricing documents",
  description: "A calm workspace for pricing documents and proposals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<ToastHost /></body></html>;
}
