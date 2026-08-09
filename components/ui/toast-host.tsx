"use client";

import { Toaster } from "sonner";

export function ToastHost() {
  return <Toaster position="top-right" theme="light" richColors closeButton duration={6500} visibleToasts={3} />;
}
