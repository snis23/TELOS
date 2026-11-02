"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { cn } from "@/lib/cn";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

/** ⋯ 버튼 메뉴 (마우스). 키보드: Enter 로 열고 ↑↓ 로 고르고 Esc 로 닫는다 */
export function MoreMenu({ label, items, className }: { label: string; items: readonly MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") buttons[(i + 1) % buttons.length]?.focus();
    if (e.key === "ArrowUp") buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="hit inline-flex size-7 items-center justify-center rounded-input text-sub hover:bg-surface-2 hover:text-ink"
      >
        <Ellipsis size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
      </button>
      {open ? (
        <div
          role="menu"
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-20 mt-1 flex min-w-36 flex-col rounded-input bg-surface p-1 outline-1 outline-line-2"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "control-h rounded-key px-3 text-left text-13 hover:bg-surface-2 focus-visible:bg-surface-2",
                item.danger ? "text-urgent-ink" : "text-ink-2",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
