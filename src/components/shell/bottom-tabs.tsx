"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { MORE_ICON, MORE_NAV, TAB_NAV, isMoreActive, isNavActive, type NavItem } from "@/lib/nav";
import { useHasUrgentExam } from "./exam-dot";

function TabItem({ item, active, dot }: { item: NavItem; active: boolean; dot?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-10",
        active ? "font-semibold text-accent-strong" : "text-sub",
      )}
    >
      <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full", active && "bg-nav-on")}>
        <Icon size={ICON_SIZE.tab} strokeWidth={ICON_STROKE} aria-hidden />
        {dot ? <span aria-label="7일 안에 일정이 있어요" className="absolute top-0.5 right-2.5 size-dot rounded-full bg-urgent-ink" /> : null}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

/** 하단 탭 (폰, 패드 세로): 오늘, 계획, 시험, 학습, 더보기 */
export function BottomTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const urgentExam = useHasUrgentExam();
  const moreActive = isMoreActive(pathname);
  const MoreIcon = MORE_ICON;

  return (
    <>
      <nav aria-label="메뉴" className="tabbar fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface land:hidden">
        {TAB_NAV.map((item) => (
          <TabItem key={item.href} item={item} active={isNavActive(pathname, item.href)} dot={item.href === "/exam/" && urgentExam} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-10",
            moreActive ? "font-semibold text-accent-strong" : "text-sub",
          )}
        >
          <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-nav-on")}>
            <MoreIcon size={ICON_SIZE.tab} strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span>더보기</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="더보기" variant="sheet">
        <ul className="flex flex-col gap-1 pb-2">
          {MORE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-input px-3 text-14",
                    active ? "bg-nav-on font-semibold text-accent-strong" : "text-ink-2",
                  )}
                >
                  <Icon size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}
