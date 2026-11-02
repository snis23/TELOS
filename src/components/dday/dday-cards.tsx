"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useDdays, useExamProgressMap } from "@/lib/data/ddays";
import { formatMonthDay } from "@/lib/date/days";
import { ddayLabel, prepPercent, selectHomeDdays, urgency, type Urgency } from "@/lib/dday/dday";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { DdayEditorDialog } from "./dday-editor";

const TONE: Record<Urgency, { card: string; ink: string; bar: "urgent" | "warn" | "normal" }> = {
  urgent: { card: "bg-urgent-bg text-urgent-ink", ink: "text-urgent-ink", bar: "urgent" },
  warn: { card: "bg-warn-bg text-warn-ink", ink: "text-warn-ink", bar: "warn" },
  normal: { card: "bg-normal-bg text-normal-ink", ink: "text-normal-ink", bar: "normal" },
};

/** 5.3 오늘 화면의 시험 일정: D-day 카드 최대 4개를 2×2 로 (과목별 타이머 옆 칸) */
export function DdayCards({ today }: { today: string }) {
  const router = useRouter();
  const { data, isPending } = useDdays();
  const progress = useExamProgressMap();
  const [editing, setEditing] = useState(false);
  const list = selectHomeDdays(data ?? [], today);

  return (
    <section aria-label="D-day" data-testid="dday-cards">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-13 font-semibold">시험 일정</h2>
        <button type="button" onClick={() => setEditing(true)} className="text-12 text-accent">
          편집
        </button>
      </div>
      {isPending ? (
        <Skeleton className="h-24 rounded-item" />
      ) : list.length === 0 ? (
        <button type="button" onClick={() => setEditing(true)} className="w-full rounded-item bg-surface px-4 py-4 text-left text-13 text-sub">
          아직 D-day 가 없어요. 눌러서 추가해요
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {list.map((d) => {
            const tone = TONE[urgency(d.date, today)];
            const pct = prepPercent(d, progress.get(d.id) ?? null);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => router.push(`/exam/?id=${d.id}`)}
                className={cn("relative flex min-w-0 flex-col gap-0.5 rounded-item px-3.5 py-3 text-left", tone.card)}
              >
                {d.pinned ? (
                  <Pin aria-label="고정됨" size={ICON_SIZE.pin} strokeWidth={ICON_STROKE} className="absolute top-3 right-3" />
                ) : null}
                <span className="truncate pr-4 text-12 font-medium">{d.title}</span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="num text-26 leading-tight font-semibold tracking-num">{ddayLabel(d.date, today)}</span>
                  <span className="shrink-0 text-11">{formatMonthDay(d.date)}</span>
                </span>
                {pct !== null ? (
                  <span className="mt-1 flex flex-col gap-1">
                    <ProgressBar value={pct / 100} label={`${d.title} 준비율`} tone={tone.bar} track={tone.bar} />
                    <span className="text-11">준비 {pct}%</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <DdayEditorDialog open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}
