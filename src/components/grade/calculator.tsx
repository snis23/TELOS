"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubjectDot } from "@/components/ui/subject-dot";
import { cn } from "@/lib/cn";
import { useAllRows } from "@/lib/data/queries";
import { useSubjectMap } from "@/lib/data/subjects";
import { averageGrade } from "@/lib/grades/grades";

/**
 * 8.2 내신 계산기: 평균 등급 = Σ(학점 × 등급) ÷ Σ학점, 소수 둘째 자리.
 * 학기별, 학년별, 전체 누적. 체크한 과목만으로 다시 계산한다.
 */
export function GradeCalculator() {
  const { data } = useAllRows("school_grades", { orderBy: "created_at" });
  const subjects = useSubjectMap();
  const rows = (data ?? []).filter((r) => subjects.has(r.subject_id));
  const subjectIds = [...new Set(rows.map((r) => r.subject_id))];
  const [off, setOff] = useState<string[]>([]);
  if (rows.length === 0) return <EmptyState message="내신 성적을 먼저 입력해 주세요" />;
  const picked = rows.filter((r) => !off.includes(r.subject_id));
  const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(2));
  const sems = [1, 2, 3].flatMap((y) => [1, 2].map((s) => ({ y, s }))).filter(({ y, s }) => rows.some((r) => r.year === y && r.semester === s));
  const years = [...new Set(sems.map((x) => x.y))];
  const excluded = picked.filter((r) => r.grade === null);

  return (
    <div className="flex flex-col gap-6">
      <Card title="계산에 넣을 과목">
        <div role="group" aria-label="과목 고르기" className="flex flex-wrap gap-2">
          {subjectIds.map((id) => {
            const s = subjects.get(id);
            if (!s) return null;
            const on = !off.includes(id);
            return (
              <label key={id} className={cn("inline-flex h-chip-phone cursor-pointer items-center gap-2 rounded-full px-3 text-13", on ? "bg-chip-on text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-surface-2 text-ink-2")}>
                <input type="checkbox" checked={on} onChange={() => setOff(on ? [...off, id] : off.filter((x) => x !== id))} className="size-4 accent-check" />
                <SubjectDot color={s.color_key} />
                {s.name}
              </label>
            );
          })}
        </div>
      </Card>
      <Card title="평균 등급">
        <table className="w-full text-13" data-testid="calc-table">
          <thead>
            <tr className="text-12 text-sub">
              <th className="py-2 text-left font-normal">구분</th>
              <th className="py-2 text-right font-normal">평균 등급</th>
            </tr>
          </thead>
          <tbody>
            {sems.map(({ y, s }) => (
              <tr key={`${y}-${s}`} className="border-t border-line">
                <td className="py-2 text-ink-2">
                  {y}학년 {s}학기
                </td>
                <td className="num py-2 text-right">{fmt(averageGrade(picked.filter((r) => r.year === y && r.semester === s)))}</td>
              </tr>
            ))}
            {years.map((y) => (
              <tr key={`y${y}`} className="border-t border-line">
                <td className="py-2 font-medium text-ink-2">{y}학년 전체</td>
                <td className="num py-2 text-right font-medium">{fmt(averageGrade(picked.filter((r) => r.year === y)))}</td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-2 font-semibold">전체 누적</td>
              <td className="num py-2 text-right text-18 font-semibold" data-testid="calc-total">
                {fmt(averageGrade(picked))}
              </td>
            </tr>
          </tbody>
        </table>
        {excluded.length ? <p className="mt-3 text-12 text-sub">등급이 없는 과목 {excluded.length}개는 계산에서 뺐어요</p> : null}
      </Card>
    </div>
  );
}
