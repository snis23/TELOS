"use client";

import { RequireAuth } from "@/lib/auth/require-auth";

/** 집중 모드: 메뉴 없이 전체 화면 (5.9) */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
