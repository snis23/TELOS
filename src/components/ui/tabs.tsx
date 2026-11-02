"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

type Tab<T extends string> = { value: T; label: string; badge?: React.ReactNode };

/** 화면 안의 탭 (계획, 시험, 학습, 성적). 마지막 선택을 기기에 기억한다 */
export function useStoredTab<T extends string>(key: string, values: readonly T[], fallback: T): [T, (v: T) => void] {
  const [tab, setTab] = useState<T>(() => {
    try {
      const v = window.localStorage.getItem(key) as T | null;
      return v && values.includes(v) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (v: T) => {
    setTab(v);
    try {
      window.localStorage.setItem(key, v);
    } catch {
      // 무시
    }
  };
  return [tab, set];
}

export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  className,
}: {
  label: string;
  tabs: readonly Tab<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.value === value);
    if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length].value);
    if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length].value);
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={cn("flex gap-1 overflow-x-auto pb-1", className)}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            id={`${id}-${t.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "control-h inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 text-13 transition-colors",
              on ? "bg-nav-on font-semibold text-accent-strong" : "text-sub hover:text-ink",
            )}
          >
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}
