"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { WEEKDAY_SHORT } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { monthMatrix } from "@/lib/exam/roadmap";
import type { RoadmapItemRow, SubjectRow } from "@/lib/supabase/database.types";

const MAX_LINES = 3;

/**
 * 시험 대비 로드맵의 큰 달력 (6장). 날짜 칸에 그날 계획(과목 점 + 무슨 공부)을 보여 준다.
 * 폰에서는 칸이 좁아 과목 점과 개수만, 패드·PC 에서는 내용까지 보여 준다. 칸을 누르면 그날 계획 창이 열린다.
 */
export function RoadmapCalendar({
  month,
  onMonthChange,
  today,
  itemsByDate,
  subjects,
  examDays,
  onOpenDay,
}: {
  month: string;
  onMonthChange: (delta: number) => void;
  today: string;
  itemsByDate: ReadonlyMap<string, readonly RoadmapItemRow[]>;
  subjects: ReadonlyMap<string, SubjectRow>;
  /** 날짜 → 그날 시험 보는 과목 이름들 */
  examDays: ReadonlyMap<string, readonly string[]>;
  onOpenDay: (date: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const weeks = monthMatrix(month);
  return (
    <section aria-label="로드맵 달력" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <IconButton aria-label="이전 달" onClick={() => onMonthChange(-1)}>
          <ChevronLeft size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
        </IconButton>
        <h3 className="num text-15 font-semibold" aria-live="polite">
          {y}년 {m}월
        </h3>
        <IconButton aria-label="다음 달" onClick={() => onMonthChange(1)}>
          <ChevronRight size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
        </IconButton>
      </div>
      <div role="grid" aria-label={`${y}년 ${m}월`} className="grid grid-cols-7 overflow-hidden rounded-card border border-line">
        <div role="row" className="contents">
          {WEEKDAY_SHORT.map((d, i) => (
            <div
              key={d}
              role="columnheader"
              className={cn("border-b border-line bg-surface-2 py-1.5 text-center text-11 text-sub", i >= 5 && "text-urgent-ink")}
            >
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div role="row" key={week[0].date} className="contents">
            {week.map((cell) => {
              const items = itemsByDate.get(cell.date) ?? [];
              const exams = examDays.get(cell.date) ?? [];
              const done = items.filter((i) => i.done_at).length;
              const day = Number(cell.date.slice(8));
              const isToday = cell.date === today;
              return (
                <button
                  key={cell.date}
                  type="button"
                  role="gridcell"
                  data-date={cell.date}
                  aria-label={`${Number(cell.date.slice(5, 7))}월 ${day}일, 계획 ${items.length}개${exams.length ? `, ${exams.join("·")} 시험` : ""}`}
                  onClick={() => onOpenDay(cell.date)}
                  className={cn(
                    "flex min-h-16 flex-col gap-1 border-b border-l border-line p-1 text-left align-top first:border-l-0 hover:bg-surface-2 pad:min-h-28 pad:p-1.5",
                    !cell.inMonth && "bg-surface-2/50 text-sub",
                    exams.length > 0 && "bg-urgent-bg/40",
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "num inline-flex size-5 items-center justify-center rounded-full text-11",
                        isToday && "bg-check font-semibold text-ink dark:text-btn-ink",
                      )}
                    >
                      {day}
                    </span>
                    {items.length > 0 ? (
                      <span className="num text-10 text-sub">
                        {done}/{items.length}
                      </span>
                    ) : null}
                  </span>
                  {exams.length > 0 ? (
                    <span className="truncate text-10 font-semibold text-urgent-ink">{exams.join("·")} 시험</span>
                  ) : null}
                  {/* 폰: 과목 점만 */}
                  <span className="flex flex-wrap gap-0.5 pad:hidden" aria-hidden>
                    {items.map((it) => {
                      const s = subjects.get(it.subject_id);
                      return s ? (
                        <span key={it.id} data-subject={s.color_key} className={cn("size-1.5 rounded-full bg-s-dot", it.done_at && "opacity-40")} />
                      ) : null;
                    })}
                  </span>
                  {/* 패드·PC: 내용 */}
                  <span className="hidden flex-col gap-0.5 pad:flex">
                    {items.slice(0, MAX_LINES).map((it) => {
                      const s = subjects.get(it.subject_id);
                      return (
                        <span key={it.id} data-subject={s?.color_key} className="flex items-center gap-1 text-10 leading-tight">
                          <span className="size-1.5 shrink-0 rounded-full bg-s-dot" aria-hidden />
                          <span className={cn("truncate text-ink-2", it.done_at && "text-sub line-through")}>
                            {s ? `${s.name} ` : ""}
                            {it.content}
                          </span>
                        </span>
                      );
                    })}
                    {items.length > MAX_LINES ? <span className="text-10 text-sub">+{items.length - MAX_LINES}개</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
