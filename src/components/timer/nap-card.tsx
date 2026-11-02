"use client";

import { useState } from "react";
import { Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { formatDurationKo, formatHMS } from "@/lib/timer/format";
import { sessionSeconds } from "@/lib/timer/sessions";
import { SessionListDialog } from "./session-list-dialog";
import { useTimerContext } from "./timer-provider";

/**
 * 5.5 쪽잠: 알람 없이 시작과 끝만 기록.
 * line: 폰의 한 줄 배치
 */
export function NapCard({ variant = "card" }: { variant?: "card" | "line" }) {
  const timer = useTimerContext();
  const [showList, setShowList] = useState(false);
  const napping = timer.napping;
  const flowing = napping ? sessionSeconds(napping, timer.now) : 0;

  const button = (
    <button
      type="button"
      onClick={timer.toggleNap}
      aria-pressed={Boolean(napping)}
      className={cn(
        "control-h inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 text-13 font-medium text-nap-ink",
        napping ? "bg-nap-on text-ink" : "bg-nap-soft",
      )}
    >
      <Moon size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
      {napping ? "쪽잠 끝" : "쪽잠 시작"}
    </button>
  );

  const summary = napping ? (
    <span className="num text-nap-ink">{formatHMS(flowing)}</span>
  ) : (
    <span className="num">{formatDurationKo(timer.nap.seconds)}</span>
  );

  if (variant === "line") {
    return (
      <section aria-label="쪽잠" className="flex items-center justify-between gap-3 rounded-item bg-surface px-4.5 py-3">
        <button type="button" onClick={() => setShowList(true)} className="flex min-w-0 items-baseline gap-2 text-left">
          <span className="text-14 font-semibold">쪽잠</span>
          <span className="text-18 font-medium">{summary}</span>
          <span className="truncate text-12 text-sub">
            {napping ? "측정 중 · 공부 타이머 멈춤" : `오늘 ${timer.nap.count}회`}
          </span>
        </button>
        {button}
        <SessionListDialog open={showList} onClose={() => setShowList(false)} kind="nap" />
      </section>
    );
  }

  return (
    <section aria-label="쪽잠" className="card flex flex-col gap-4">
      <button type="button" onClick={() => setShowList(true)} className="flex flex-col items-start gap-1 text-left">
        <span className="text-14 font-semibold">쪽잠</span>
        <span className="text-28 leading-tight font-medium">{summary}</span>
        <span className="text-12 text-sub">{napping ? "측정 중 · 공부 타이머 멈춤" : `오늘 ${timer.nap.count}회`}</span>
      </button>
      <div>{button}</div>
      <SessionListDialog open={showList} onClose={() => setShowList(false)} kind="nap" />
    </section>
  );
}
