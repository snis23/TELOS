"use client";

import { Pencil } from "lucide-react";
import { EXAM_KIND_LABELS } from "@/components/dday/dday-dialog";
import { IconButton } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { ddayLabel, isUpcoming } from "@/lib/dday/dday";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { DdayRow } from "@/lib/supabase/database.types";

/** 고정한 시험 중 가장 가까운 것, 없으면 가장 가까운 시험 */
export function heroExam(ddays: readonly DdayRow[], today: string): DdayRow | null {
  const exams = ddays.filter((d) => d.type === "exam" && isUpcoming(d, today)).sort((a, b) => a.date.localeCompare(b.date));
  return exams.find((d) => d.pinned) ?? exams[0] ?? null;
}

/** 시험 대비 카테고리 위쪽 큰 카드: --timer-bg, 시험 이름과 종류, "D-36"(40px), "12월 8일 (화) 시작", 로드맵 진행 막대 */
export function ExamHero({
  exam,
  today,
  progress,
  onEdit,
}: {
  exam: DdayRow;
  today: string;
  progress: number | null;
  onEdit?: () => void;
}) {
  const past = exam.date < today;
  return (
    <section aria-label={exam.title} className="flex flex-col gap-2 rounded-card bg-timer-bg px-4.5 py-5.5 pad:p-7">
      <div className="flex items-start justify-between gap-2">
        <p className="text-13 text-ink-2">
          {exam.title}
          {exam.exam_kind ? <span className="ml-2 text-12 text-sub">{EXAM_KIND_LABELS[exam.exam_kind]}</span> : null}
        </p>
        {onEdit ? (
          <IconButton aria-label={`${exam.title} 수정`} onClick={onEdit}>
            <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
          </IconButton>
        ) : null}
      </div>
      <p className="num text-40 leading-none font-medium tracking-num">{past ? "끝난 시험" : ddayLabel(exam.date, today)}</p>
      <p className="text-12 text-sub">{formatMonthDayWeekday(exam.date)} 시작</p>
      <div className="mt-2 flex items-center gap-3">
        <ProgressBar value={progress ?? 0} label="로드맵 진행률" />
        <span className="num w-10 shrink-0 text-right text-12 text-sub">{Math.round((progress ?? 0) * 100)}%</span>
      </div>
    </section>
  );
}
