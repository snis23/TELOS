"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { SubjectDot } from "@/components/ui/subject-dot";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useReviewChecks, useUnits } from "@/lib/data/plan";
import { useSubjects } from "@/lib/data/subjects";
import type { DdayRow, UnitRow } from "@/lib/supabase/database.types";
import { reviewSummary } from "./review-summary";

/** 6.5 회독 탭: 시험 × 과목마다 단원 행과 1·2·3회 체크 열 */
export function ReviewTab({ exam }: { exam: DdayRow | null }) {
  const { data: subjects } = useSubjects();
  const { data: units } = useUnits();
  const { data: checks } = useReviewChecks();
  const { insert, update } = useTableMutations("review_checks");
  const withUnits = (subjects ?? []).filter((s) => (units ?? []).some((u) => u.subject_id === s.id));
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const current = withUnits.find((s) => s.id === subjectId) ?? withUnits[0];

  if (!exam) return <EmptyState message="시험을 먼저 추가해 주세요" />;
  if (!current) return <EmptyState message="계획 > 진행표에서 단원을 먼저 추가해 주세요" />;
  const subjectUnits = (units ?? []).filter((u) => u.subject_id === current.id);
  const examChecks = (checks ?? []).filter((c) => c.dday_id === exam.id);
  const summary = reviewSummary(subjectUnits, examChecks);

  const toggle = (unit: UnitRow, round: 1 | 2 | 3, value: boolean) => {
    const key = `round${round}` as const;
    const existing = examChecks.find((c) => c.unit_id === unit.id);
    if (existing) update.mutate({ ids: [existing.id], patch: { [key]: value } });
    else insert.mutate({ rows: [{ id: newId(), dday_id: exam.id, unit_id: unit.id, [key]: value }] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="과목 고르기" className="flex flex-wrap gap-2">
        {withUnits.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === current.id}
            onClick={() => setSubjectId(s.id)}
            className={cn(
              "inline-flex h-chip-phone items-center gap-2 rounded-full px-3 text-13 pad:h-chip",
              s.id === current.id ? "bg-chip-on text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-surface text-ink-2",
            )}
          >
            <SubjectDot color={s.color_key} />
            {s.name}
          </button>
        ))}
      </div>
      <section className="card" aria-label={`${current.name} 회독`}>
        <table className="w-full text-13">
          <thead>
            <tr className="text-12 text-sub">
              <th className="py-2 text-left font-normal">단원</th>
              {[1, 2, 3].map((r) => (
                <th key={r} className="w-14 py-2 font-normal">
                  {r}회
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjectUnits.map((u) => {
              const c = examChecks.find((x) => x.unit_id === u.id);
              return (
                <tr key={u.id} className="border-t border-line">
                  <td className="py-1.5 text-ink-2">{u.name}</td>
                  {([1, 2, 3] as const).map((r) => (
                    <td key={r} className="text-center">
                      <Checkbox
                        checked={Boolean(c?.[`round${r}`])}
                        onChange={(v) => toggle(u, r, v)}
                        label={`${u.name} ${r}회독`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="num mt-3 text-12 text-sub" data-testid="review-summary">
          {summary.label}
        </p>
      </section>
    </div>
  );
}
