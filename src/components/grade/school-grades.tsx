"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { SubjectDot } from "@/components/ui/subject-dot";
import { Badge } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useAllRows } from "@/lib/data/queries";
import { useSubjectMap, useSubjects } from "@/lib/data/subjects";
import { averageGrade, schoolGrade, semesterLabel } from "@/lib/grades/grades";
import type { Achievement, SchoolGradeRow, SubjectRow } from "@/lib/supabase/database.types";
import { useLayout } from "@/lib/use-layout";
import { GradeLineChart } from "./line-chart";

/** 8.2 입력 규칙 (DB CHECK 와 같다) */
const rowSchema = z
  .object({
    credits: z.number({ error: "학점을 입력해 주세요" }).int("정수로 입력해 주세요").min(1, "1~8").max(8, "1~8"),
    raw_score: z
      .number({ error: "원점수를 입력해 주세요" })
      .min(0, "0~100")
      .max(100, "0~100")
      .refine((v) => Math.round(v * 10) === v * 10, "소수 첫째 자리까지"),
    subject_avg: z.number().min(0, "0~100").max(100, "0~100").nullable(),
    achievement: z.enum(["A", "B", "C", "D", "E"]).nullable(),
    rank: z.number().int().min(1, "1 이상").nullable(),
    tie_count: z.number().int().min(1, "1 이상"),
    total_students: z.number().int().min(1, "1 이상").nullable(),
    grade: z.number().int().min(1).max(5).nullable(),
    grade_manual: z.boolean(),
  })
  .refine((v) => (v.rank === null) === (v.total_students === null), { path: ["rank"], message: "석차와 수강자 수를 함께 써 주세요" })
  .refine((v) => v.rank === null || v.total_students === null || v.rank <= v.total_students, { path: ["rank"], message: "수강자 수 이하로" });

type Draft = Record<
  "credits" | "raw_score" | "subject_avg" | "achievement" | "rank" | "tie_count" | "total_students",
  string
> & { gradeOverride: string };

const FIELDS: { key: keyof Omit<Draft, "gradeOverride" | "achievement">; label: string; mode: "numeric" | "decimal" }[] = [
  { key: "credits", label: "학점", mode: "numeric" },
  { key: "raw_score", label: "원점수", mode: "decimal" },
  { key: "subject_avg", label: "평균", mode: "decimal" },
  { key: "rank", label: "석차", mode: "numeric" },
  { key: "tie_count", label: "동석차", mode: "numeric" },
  { key: "total_students", label: "수강자", mode: "numeric" },
];

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

function toDraft(r?: SchoolGradeRow): Draft {
  return {
    credits: r ? String(r.credits) : "",
    raw_score: r ? String(r.raw_score) : "",
    subject_avg: r?.subject_avg != null ? String(r.subject_avg) : "",
    achievement: r?.achievement ?? "",
    rank: r?.rank != null ? String(r.rank) : "",
    tie_count: r ? String(r.tie_count) : "1",
    total_students: r?.total_students != null ? String(r.total_students) : "",
    gradeOverride: r?.grade_manual && r.grade ? String(r.grade) : "",
  };
}

/** 석차로 등급 자동 계산 */
function autoGrade(d: Draft): number | null {
  const rank = num(d.rank);
  const total = num(d.total_students);
  if (!rank || !total || rank > total) return null;
  return schoolGrade(rank, num(d.tie_count) ?? 1, total);
}

const SEMESTERS = [1, 2, 3].flatMap((year) => [1, 2].map((semester) => ({ year, semester })));

/** 8.2 내신: 학기를 고르고 여러 과목을 표 한 장에서 연속으로 입력 */
export function SchoolGrades() {
  const layout = useLayout();
  const { data: rows } = useAllRows("school_grades", { orderBy: "created_at" });
  const { data: subjectList } = useSubjects();
  const subjects = useSubjectMap();
  const [sem, setSem] = useState(SEMESTERS[0]);
  const grades = useMemo(() => rows ?? [], [rows]);
  const twoColumns = layout === "land" || layout === "pc";

  const semesterList = (
    <ul className="flex flex-col gap-1" aria-label="학기">
      {SEMESTERS.map((s) => {
        const list = grades.filter((g) => g.year === s.year && g.semester === s.semester);
        const avg = averageGrade(list);
        const on = s.year === sem.year && s.semester === sem.semester;
        return (
          <li key={`${s.year}-${s.semester}`}>
            <button
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => setSem(s)}
              className={cn("flex min-h-11 w-full items-center justify-between rounded-input px-3 text-13", on ? "bg-nav-on font-semibold text-accent-strong" : "text-ink-2")}
            >
              <span>
                {s.year}학년 {s.semester}학기
              </span>
              <span className="num text-12">{avg !== null ? avg.toFixed(2) : list.length ? "–" : ""}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      {twoColumns ? (
        <div className="grid grid-cols-[14rem_minmax(0,1fr)] items-start gap-8">
          <div className="card">{semesterList}</div>
          <SemesterTable key={`${sem.year}-${sem.semester}`} year={sem.year} semester={sem.semester} grades={grades} subjects={subjectList ?? []} />
        </div>
      ) : (
        <>
          <SelectField
            label="학기"
            value={`${sem.year}-${sem.semester}`}
            onChange={(v) => {
              const [y, s] = v.split("-").map(Number);
              setSem({ year: y, semester: s });
            }}
            options={SEMESTERS.map((s) => ({ value: `${s.year}-${s.semester}`, label: `${s.year}학년 ${s.semester}학기` }))}
          />
          <SemesterTable key={`${sem.year}-${sem.semester}`} year={sem.year} semester={sem.semester} grades={grades} subjects={subjectList ?? []} />
        </>
      )}
      <SchoolCharts grades={grades} subjects={subjects} />
    </div>
  );
}

function SemesterTable({ year, semester, grades, subjects }: { year: number; semester: number; grades: SchoolGradeRow[]; subjects: SubjectRow[] }) {
  const { insert, update } = useTableMutations("school_grades", { unique: "이 학기에 이미 있는 과목이에요" });
  const existing = grades.filter((g) => g.year === year && g.semester === semester);
  const shown = subjects.filter((s) => s.show_in_school_notes || existing.some((g) => g.subject_id === s.id));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(shown.map((s) => [s.id, toDraft(existing.find((g) => g.subject_id === s.id))])),
  );
  const [errors, setErrors] = useState<Record<string, Partial<Record<string, string>>>>({});
  const [saved, setSaved] = useState(false);

  const set = (id: string, patch: Partial<Draft>) => {
    setSaved(false);
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? toDraft()), ...patch } }));
  };

  const save = () => {
    const nextErrors: typeof errors = {};
    const inserts: Partial<SchoolGradeRow>[] = [];
    for (const s of shown) {
      const d = drafts[s.id] ?? toDraft();
      const prev = existing.find((g) => g.subject_id === s.id);
      if (!prev && d.raw_score.trim() === "" && d.credits.trim() === "") continue;
      const auto = autoGrade(d);
      const manual = d.gradeOverride !== "";
      const parsed = rowSchema.safeParse({
        credits: num(d.credits) ?? Number.NaN,
        raw_score: num(d.raw_score) ?? Number.NaN,
        subject_avg: num(d.subject_avg),
        achievement: (d.achievement || null) as Achievement | null,
        rank: num(d.rank),
        tie_count: num(d.tie_count) ?? 1,
        total_students: num(d.total_students),
        grade: manual ? Number(d.gradeOverride) : auto,
        grade_manual: manual,
      });
      if (!parsed.success) {
        nextErrors[s.id] = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
        continue;
      }
      if (prev) update.mutate({ ids: [prev.id], patch: parsed.data });
      else inserts.push({ id: newId(), year, semester, subject_id: s.id, ...parsed.data });
    }
    if (inserts.length) insert.mutate({ rows: inserts });
    setErrors(nextErrors);
    setSaved(Object.keys(nextErrors).length === 0);
  };

  if (shown.length === 0) return <EmptyState message="과목을 먼저 추가해 주세요" />;
  const input = "control-h w-full min-w-0 rounded-input bg-surface-2 px-2 text-13 text-ink num outline-none focus-visible:outline-2 focus-visible:outline-check";

  return (
    <Card title={`${year}학년 ${semester}학기`} actions={<Button onClick={save}>저장</Button>}>
      <div className="flex flex-col" data-testid="grade-table">
        {shown.map((s) => {
          const d = drafts[s.id] ?? toDraft();
          const auto = autoGrade(d);
          const e = errors[s.id] ?? {};
          const manual = d.gradeOverride !== "";
          const shownGrade = manual ? Number(d.gradeOverride) : auto;
          return (
            <section key={s.id} aria-label={`${s.name} 성적`} className="grid grid-cols-4 items-end gap-2 border-b border-line py-3 last:border-b-0 pad:grid-cols-[6rem_repeat(8,minmax(0,1fr))]">
              <p className="col-span-4 flex items-center gap-2 text-13 font-medium pad:col-span-1 pad:pb-2.5">
                <SubjectDot color={s.color_key} />
                {s.name}
              </p>
              {FIELDS.map((f) => (
                <label key={f.key} className="flex min-w-0 flex-col gap-1">
                  <span className="text-11 text-sub">{f.label}</span>
                  <input
                    aria-label={`${s.name} ${f.label}`}
                    inputMode={f.mode}
                    value={d[f.key]}
                    onChange={(ev) => set(s.id, { [f.key]: ev.target.value.replace(f.mode === "numeric" ? /[^0-9]/g : /[^0-9.]/g, "") })}
                    aria-invalid={e[f.key] ? true : undefined}
                    className={input}
                  />
                  {e[f.key] ? <span className="text-11 text-urgent-ink">{e[f.key]}</span> : null}
                </label>
              ))}
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-11 text-sub">성취도</span>
                <select aria-label={`${s.name} 성취도`} value={d.achievement} onChange={(ev) => set(s.id, { achievement: ev.target.value })} className={input}>
                  <option value="">–</option>
                  {["A", "B", "C", "D", "E"].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 flex min-w-0 flex-col gap-1 pad:col-span-1">
                <span className="text-11 text-sub">등급</span>
                <select
                  aria-label={`${s.name} 등급`}
                  value={d.gradeOverride}
                  onChange={(ev) => set(s.id, { gradeOverride: ev.target.value })}
                  className={input}
                  data-testid={`grade-${s.name}`}
                >
                  <option value="">{auto ? `${auto} (자동)` : "자동"}</option>
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={String(g)}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <p className="col-span-4 text-11 text-sub pad:col-span-9">
                {manual ? <Badge tone="warn" className="mr-2">직접 입력</Badge> : null}
                {shownGrade === null && d.achievement ? "성취도만 있는 과목은 평균 등급 계산에서 빼요 · " : ""}
                {e.rank ? <span className="text-urgent-ink">{e.rank} · </span> : null}
                성적표와 다르면 직접 고쳐 주세요
              </p>
            </section>
          );
        })}
      </div>
      {saved ? (
        <p role="status" className="mt-3 text-12 text-ok-ink">
          저장했어요
        </p>
      ) : null}
    </Card>
  );
}

function SchoolCharts({ grades, subjects }: { grades: SchoolGradeRow[]; subjects: ReturnType<typeof useSubjectMap> }) {
  const sems = SEMESTERS.filter((s) => grades.some((g) => g.year === s.year && g.semester === s.semester));
  const [chosen, setChosen] = useState<string[]>([]);
  const withGrades = [...new Set(grades.filter((g) => g.grade).map((g) => g.subject_id))].filter((id) => subjects.has(id));
  if (sems.length === 0) return null;
  const avgData = sems.map((s) => ({
    x: semesterLabel(s.year, s.semester),
    avg: averageGrade(grades.filter((g) => g.year === s.year && g.semester === s.semester)),
  }));
  const picked = chosen.length ? chosen.filter((c) => withGrades.includes(c)) : withGrades.slice(0, 2);
  const subjectData = sems.map((s) => {
    const row: Record<string, string | number | null> = { x: semesterLabel(s.year, s.semester) };
    for (const id of picked) row[id] = grades.find((g) => g.subject_id === id && g.year === s.year && g.semester === s.semester)?.grade ?? null;
    return row;
  });
  return (
    <div className="grid gap-6 land:grid-cols-2">
      <Card title="평균 등급 추이">
        <GradeLineChart
          label="학기별 평균 등급"
          data={avgData}
          series={[{ key: "avg", name: "평균 등급", color: "accent" }]}
          domain={[1, 5]}
          reversed
          format={(v) => v.toFixed(2)}
        />
      </Card>
      <Card title="과목별 등급 추이">
        <div role="group" aria-label="과목 고르기" className="mb-3 flex flex-wrap gap-2">
          {withGrades.map((id) => {
            const s = subjects.get(id);
            if (!s) return null;
            const on = picked.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setChosen(on ? picked.filter((x) => x !== id) : [...picked, id])}
                className={cn(
                  "inline-flex h-chip-phone items-center gap-2 rounded-full px-3 text-13",
                  on ? "bg-chip-on text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-surface-2 text-ink-2",
                )}
              >
                <SubjectDot color={s.color_key} />
                {s.name}
              </button>
            );
          })}
        </div>
        <GradeLineChart
          label="과목별 등급"
          data={subjectData}
          series={picked.map((id) => ({ key: id, name: subjects.get(id)?.name ?? "", color: subjects.get(id)?.color_key ?? "periwinkle" }))}
          domain={[1, 5]}
          reversed
        />
      </Card>
    </div>
  );
}
