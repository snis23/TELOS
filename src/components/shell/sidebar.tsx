"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useThemeSetting } from "@/lib/data/theme-setting";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { MAIN_NAV, SETTINGS_NAV, isNavActive, type NavItem } from "@/lib/nav";
import { useHasUrgentExam } from "./exam-dot";
import { SyncStatus } from "./sync-status";

function NavLink({ item, collapsed, dot }: { item: NavItem; collapsed: boolean; dot?: boolean }) {
  const pathname = usePathname();
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "hit relative flex h-9 items-center gap-2.5 rounded-input px-3 text-13 transition-colors",
        active ? "bg-nav-on font-semibold text-accent-strong" : "text-sub hover:text-ink",
        collapsed && "land:justify-center land:px-0 pc:justify-start pc:px-3",
      )}
    >
      <Icon size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0" />
      <span className={cn(collapsed && "land:sr-only pc:not-sr-only")}>{item.label}</span>
      {dot ? (
        <span
          aria-label="7일 안에 일정이 있어요"
          className={cn("size-dot rounded-full bg-urgent-ink", collapsed ? "absolute top-1.5 right-1.5 pc:static" : "")}
        />
      ) : null}
    </Link>
  );
}

/** 사이드바 (PC, 패드 가로): 너비 200px, 패드 가로에서는 64px 로 접을 수 있다 */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { resolved, toggle } = useThemeSetting();
  const urgentExam = useHasUrgentExam();
  return (
    <aside
      aria-label="메뉴"
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col bg-surface px-3 py-6 land:flex",
        collapsed ? "land:w-sidebar-collapsed land:px-2 pc:w-sidebar pc:px-3" : "w-sidebar",
      )}
    >
      <div className={cn("mb-6 flex items-center justify-between px-3", collapsed && "land:justify-center land:px-0 pc:justify-between pc:px-3")}>
        <span className={cn("text-15 font-semibold tracking-brand", collapsed && "land:sr-only pc:not-sr-only")}>Telos</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          className="hit inline-flex size-7 items-center justify-center rounded-input text-sub hover:bg-surface-2 hover:text-ink pc:hidden"
        >
          {collapsed ? (
            <PanelLeftOpen size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
          ) : (
            <PanelLeftClose size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} dot={item.href === "/exam/" && urgentExam} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className={cn("px-3", collapsed && "land:flex land:justify-center land:px-0 pc:block pc:px-3")}>
          <SyncStatus compact={collapsed} />
        </div>
        <div className={cn("flex items-center justify-between px-3", collapsed && "land:justify-center land:px-0 pc:justify-between pc:px-3")}>
          <span className={cn("text-13 text-sub", collapsed && "land:sr-only pc:not-sr-only")}>다크 모드</span>
          <Switch checked={resolved === "dark"} onChange={toggle} label="다크 모드" />
        </div>
        <NavLink item={SETTINGS_NAV} collapsed={collapsed} />
      </div>
    </aside>
  );
}
