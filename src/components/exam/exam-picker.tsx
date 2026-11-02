"use client";

import { cn } from "@/lib/cn";
import { formatMonthDay } from "@/lib/date/days";
import type { DdayRow } from "@/lib/supabase/database.types";

/** 시험 고르기 (범위 분배, 회독) */
export function ExamPicker({ exams, value, onChange }: { exams: readonly DdayRow[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="시험 고르기" className="flex flex-wrap gap-2">
      {exams.map((e) => (
        <button
          key={e.id}
          type="button"
          role="radio"
          aria-checked={e.id === value}
          onClick={() => onChange(e.id)}
          className={cn(
            "control-h rounded-full px-3.5 text-13",
            e.id === value ? "bg-chip-on font-semibold text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-surface text-ink-2",
          )}
        >
          {e.title} <span className="num text-11 text-sub">{formatMonthDay(e.date)}</span>
        </button>
      ))}
    </div>
  );
}
