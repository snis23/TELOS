"use client";

import { AppShell } from "@/components/shell/app-shell";
import { RequireAuth } from "@/lib/auth/require-auth";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
