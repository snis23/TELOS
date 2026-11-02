"use client";

import { ProgressBar } from "@/components/ui/progress";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { ddayLabel, isUpcoming } from "@/lib/dday/dday";
import type { DdayRow } from "@/lib/supabase/database.types";

/** 고정한 시험 중 가장 가까운 것, 없으면 가장 가까운 시험 */
export function heroExam(ddays: readonly DdayRow[], today: string): DdayRow | null {
  const exams = ddays.filter((d) => d.type === "exam" && isUpcoming(d, today)).sort((a, b) => a.date.localeCompare(b.date));
  return exams.find((d) => d.pinned) ?? exams[0] ?? null;
}

/** 6.5 시험 화면 위쪽 큰 카드: --timer-bg, 시험 이름, "D-36"(40px), "12월 8일 (화) 시작", 총복습, 전체 범위 진행 막대 */
export function ExamHero({ exam, today, progress }: { exam: DdayRow | null; today: string; progress: number | null }) {
  if (!exam) {
    return (
      <section className="rounded-card bg-timer-bg px-4.5 py-5.5 text-13 text-sub pad:p-7">
        다가오는 시험이 없어요. 일정 탭에서 시험을 추가해요
      </section>
    );
  }
  return (
    <section aria-label={exam.title} className="flex flex-col gap-2 rounded-card bg-timer-bg px-4.5 py-5.5 pad:p-7">
      <p className="text-13 text-ink-2">{exam.title}</p>
      <p className="num text-40 leading-none font-medium tracking-num">{ddayLabel(exam.date, today)}</p>
      <p className="text-12 text-sub">
        {formatMonthDayWeekday(exam.date)} 시작 · 마지막 {exam.review_days}일은 총복습
      </p>
      <div className="mt-2 flex items-center gap-3">
        <ProgressBar value={progress ?? 0} label="전체 범위 진행률" />
        <span className="num w-10 shrink-0 text-right text-12 text-sub">{Math.round((progress ?? 0) * 100)}%</span>
      </div>
    </section>
  );
}
