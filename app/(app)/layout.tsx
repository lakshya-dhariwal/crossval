import { requirePageUser } from "@/lib/auth/require-user";
import { ensureSampleDocument } from "@/lib/services/documents";
import { AppShell } from "@/components/app-shell/app-shell";
export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) { const user = await requirePageUser(); await ensureSampleDocument(user.id); return <AppShell email={user.email ?? "Account"}>{children}</AppShell>; }
