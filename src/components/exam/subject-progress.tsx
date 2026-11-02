"use client";

import { ProgressBar } from "@/components/ui/progress";
import { SubjectDot } from "@/components/ui/subject-dot";
import type { SubjectProgress } from "@/lib/exam/roadmap";
import type { SubjectRow } from "@/lib/supabase/database.types";

const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);

/**
 * 과목별 로드맵 진행 (진행표). 끝낸 칸 ÷ 전체 칸, 오늘까지 계획 실현률, 회독별 진행.
 * 시험 대비 화면, 계획 > 진행표, 기록 화면이 함께 쓴다.
 */
export function SubjectProgressList({
  rows,
  subjects,
  extra,
}: {
  rows: readonly SubjectProgress[];
  subjects: ReadonlyMap<string, SubjectRow>;
  /** 과목 줄 오른쪽에 붙일 내용 (시험 날짜 등) */
  extra?: (subjectId: string) => React.ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-3.5" aria-label="과목별 진행">
      {rows.map((p) => {
        const s = subjects.get(p.subjectId);
        if (!s) return null;
        return (
          <li key={p.subjectId} className="flex flex-col gap-1.5" data-subject={s.color_key}>
            <div className="flex items-center gap-2">
              <SubjectDot color={s.color_key} />
              <span className="min-w-0 flex-1 truncate text-13 font-medium text-ink-2">{s.name}</span>
              <span className="num text-12 text-sub">
                {p.done}/{p.total}
              </span>
              <span className="num w-10 text-right text-12 font-medium text-ink-2">{pct(p.rate)}</span>
            </div>
            <ProgressBar value={p.rate ?? 0} label={`${s.name} 로드맵 진행률`} tone="subject" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-11 text-sub">
              {extra?.(p.subjectId)}
              <span>
                오늘까지 계획 {p.dueDone}/{p.dueTotal}
                {p.dueRate != null ? ` (${pct(p.dueRate)})` : ""}
              </span>
              {p.rounds.map((r) => (
                <span key={r.round} className="num">
                  {r.round}회독 {r.done}/{r.total}
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
