"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/cn";
import { useProfile, useUpdateProfile } from "@/lib/data/profile";
import { useRealtimeSync } from "@/lib/data/realtime";
import { useThemeSync } from "@/lib/data/theme-setting";
import { BottomTabs } from "./bottom-tabs";
import { GlobalShortcuts } from "./global-shortcuts";
import { OfflineBanner } from "./offline-banner";
import { ShortcutTable } from "./shortcut-table";
import { Sidebar } from "./sidebar";
import { useAppStartup } from "./startup";

const COLLAPSED_KEY = "telos:sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** 사이드바 접힘 상태: 계정에 저장하고, 첫 화면은 기기 값으로 바로 그린다 */
function useSidebarCollapsed(): [boolean, () => void] {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const accountValue = profile?.sidebar_collapsed;

  useEffect(() => {
    if (accountValue === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 계정 값(다른 기기에서 바꾼 값 포함)을 따른다
    setCollapsed(accountValue);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, accountValue ? "1" : "0");
    } catch {
      // 저장하지 못해도 화면은 바뀐다
    }
  }, [accountValue]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // 무시
    }
    updateProfile.mutate({ sidebar_collapsed: next });
  };
  return [collapsed, toggle];
}

/** 로그인한 화면의 틀: 사이드바(패드 가로·PC) 또는 하단 탭(폰·패드 세로) */
export function AppShell({ children }: { children: React.ReactNode }) {
  const userId = useUserId();
  useRealtimeSync(userId);
  useThemeSync();
  useAppStartup();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-input focus:bg-surface focus:px-3 focus:py-2">
        본문으로 건너뛰기
      </a>
      <GlobalShortcuts />
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className={cn("min-w-0", collapsed ? "land:pl-sidebar-collapsed pc:pl-sidebar" : "land:pl-sidebar")}>
        <OfflineBanner />
        <main id="main" className="page-area mx-auto w-full max-w-content">
          {children}
          <ShortcutTable />
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
