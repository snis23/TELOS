"use client";

import { Card } from "@/components/ui/card";
import { SubjectDot } from "@/components/ui/subject-dot";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useMockRounds } from "@/lib/data/learn";
import { useAllRows } from "@/lib/data/queries";
import { useSubjects } from "@/lib/data/subjects";
import { targetGap } from "@/lib/grades/grades";

/** 8.4 목표 등급: 과목마다 내신(1~5)·모의고사(1~9) 목표와 현재 값의 차이 */
export function Targets() {
  const { data: subjects } = useSubjects();
  const { data: targets } = useAllRows("targets", { orderBy: "created_at" });
  const { data: grades } = useAllRows("school_grades", { orderBy: "created_at" });
  const { data: scores } = useAllRows("mock_scores", { orderBy: "created_at" });
  const { data: rounds } = useMockRounds();
  const { insert, update } = useTableMutations("targets");

  const latestSchool = (id: string) =>
    [...(grades ?? [])].filter((g) => g.subject_id === id && g.grade).sort((a, b) => b.year - a.year || b.semester - a.semester)[0]?.grade ?? null;
  const roundOrder = new Map((rounds ?? []).map((r) => [r.id, r.year * 100 + r.month]));
  const latestMock = (id: string) =>
    [...(scores ?? [])]
      .filter((s) => s.subject_id === id && s.grade)
      .sort((a, b) => (roundOrder.get(b.mock_round_id) ?? 0) - (roundOrder.get(a.mock_round_id) ?? 0))[0]?.grade ?? null;

  const setTarget = (subjectId: string, patch: { school_target?: number | null; mock_target?: number | null }) => {
    const t = (targets ?? []).find((x) => x.subject_id === subjectId);
    if (t) update.mutate({ ids: [t.id], patch });
    else insert.mutate({ rows: [{ id: newId(), subject_id: subjectId, school_target: null, mock_target: null, ...patch }] });
  };

  const select = "control-h w-full rounded-input bg-surface-2 px-2 text-13 text-ink num";
  const gapText = (current: number | null, target: number | null) => {
    const g = targetGap(current, target);
    if (!g) return <span className="text-12 text-sub">–</span>;
    return <span className={cn("text-12", g.achieved ? "font-semibold text-ok-ink" : "text-ink-2")}>{g.label}</span>;
  };

  return (
    <Card title="목표 등급">
      <div className="flex flex-col">
        {(subjects ?? []).map((s) => {
          const t = (targets ?? []).find((x) => x.subject_id === s.id);
          const school = latestSchool(s.id);
          const mock = latestMock(s.id);
          return (
            <section key={s.id} aria-label={`${s.name} 목표`} className="grid grid-cols-2 items-center gap-3 border-b border-line py-3 last:border-b-0 pad:grid-cols-[8rem_1fr_1fr]">
              <p className="col-span-2 flex items-center gap-2 text-13 font-medium pad:col-span-1">
                <SubjectDot color={s.color_key} />
                {s.name}
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-11 text-sub" htmlFor={`st-${s.id}`}>
                  내신 목표 · 지금 <span className="num">{school ?? "–"}</span>
                </label>
                <select id={`st-${s.id}`} value={t?.school_target ?? ""} onChange={(e) => setTarget(s.id, { school_target: e.target.value ? Number(e.target.value) : null })} className={select}>
                  <option value="">–</option>
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      {g}등급
                    </option>
                  ))}
                </select>
                {gapText(school, t?.school_target ?? null)}
              </div>
              {s.mock_max_score ? (
                <div className="flex flex-col gap-1">
                  <label className="text-11 text-sub" htmlFor={`mt-${s.id}`}>
                    모의고사 목표 · 지금 <span className="num">{mock ?? "–"}</span>
                  </label>
                  <select id={`mt-${s.id}`} value={t?.mock_target ?? ""} onChange={(e) => setTarget(s.id, { mock_target: e.target.value ? Number(e.target.value) : null })} className={select}>
                    <option value="">–</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                      <option key={g} value={g}>
                        {g}등급
                      </option>
                    ))}
                  </select>
                  {gapText(mock, t?.mock_target ?? null)}
                </div>
              ) : (
                <span />
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
