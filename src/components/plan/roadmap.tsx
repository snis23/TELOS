"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Send } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { SortableList } from "@/components/ui/sortable";
import { SubjectDot } from "@/components/ui/subject-dot";
import { SubjectTag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/data/crud";
import { useGoalMutations, useGoalTasks, useGoals } from "@/lib/data/plan";
import { useProfile } from "@/lib/data/profile";
import { useSubjectMap, useSubjects } from "@/lib/data/subjects";
import { useTaskMutations } from "@/lib/data/tasks";
import { useToday } from "@/lib/data/today";
import { formatMonthDay } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { LEVEL_LABELS, goalProgress, isPastGoal, monthOf, monthRange, overlaps, semesterOf, weekRange } from "@/lib/plan/goals";
import type { GoalRow } from "@/lib/supabase/database.types";
import { GoalDialog, type GoalFormValues } from "./goal-dialog";

type View = "period" | "subject";
type Range = "week" | "month" | "semester" | "all";

/** 6.2 로드맵: 기간별 보기(기본) / 과목별 보기 */
export function Roadmap() {
  const today = useToday();
  const { data: goalsData } = useGoals();
  const { data: tasks } = useGoalTasks();
  const { data: subjectList } = useSubjects();
  const subjects = useSubjectMap();
  const { data: profile } = useProfile();
  const { insert, update, trash, reorder } = useGoalMutations();
  const taskMut = useTaskMutations();
  const toast = useToast();
  const [view, setView] = useState<View>("period");
  const [range, setRange] = useState<Range>("month");
  const [filter, setFilter] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ goal: GoalRow | null; defaults?: Partial<GoalFormValues> } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  const goals = useMemo(() => goalsData ?? [], [goalsData]);
  const progressOf = (g: GoalRow) => goalProgress(g, goals, tasks ?? []);
  const childrenOf = (g: GoalRow) => goals.filter((c) => c.parent_id === g.id).sort((a, b) => a.sort_order - b.sort_order);
  const visible = goals.filter((g) => filter.length === 0 || (g.subject_id ? filter.includes(g.subject_id) : true));
  const current = visible.filter((g) => !isPastGoal(g, today));
  const past = visible.filter((g) => isPastGoal(g, today));

  const save = (v: GoalFormValues) => {
    const patch = { ...v, memo: v.memo || null };
    if (editing?.goal) update.mutate({ ids: [editing.goal.id], patch });
    else insert.mutate({ rows: [{ id: newId(), ...patch, sort_order: goals.length }], appendTo: ["goals", "all", "sort_order", false] });
  };

  /** 주 목표 → 그 주의 할 일로 (6.2) */
  const sendToWeek = (g: GoalRow) => {
    const wk = weekRange(g.start_date);
    const date = today >= wk.start && today <= wk.end ? today : g.start_date;
    taskMut.insert.mutate({
      rows: [{ id: newId(), title: g.title, subject_id: g.subject_id, study_date: date, source: "goal", goal_id: g.id }],
    });
    toast.show({ message: "주간 계획으로 보냈어요" });
  };

  const row = (g: GoalRow, handle?: React.ReactNode, depth = 0, withChildren = false) => {
    const kids = childrenOf(g);
    const linked = (tasks ?? []).some((t) => t.goal_id === g.id && !t.deleted_at);
    const manual = kids.length === 0 && !linked;
    const p = progressOf(g);
    const subject = g.subject_id ? subjects.get(g.subject_id) : undefined;
    return (
      <div className={cn("flex flex-col", depth > 0 && "pl-6")}>
        <div className="flex min-h-11 items-center gap-2 py-1">
          {handle}
          {manual ? (
            <Checkbox
              checked={Boolean(g.done_at)}
              label={`${g.title} 완료`}
              onChange={(v) => update.mutate({ ids: [g.id], patch: { done_at: v ? new Date().toISOString() : null } })}
            />
          ) : null}
          <button type="button" onClick={() => setEditing({ goal: g })} className="flex min-w-0 flex-1 flex-col text-left">
            <span className={cn("truncate text-13", g.done_at ? "text-sub line-through" : "text-ink-2")}>{g.title}</span>
            <span className="text-11 text-sub">
              {LEVEL_LABELS[g.level]} · {formatMonthDay(g.start_date)}–{formatMonthDay(g.end_date)}
            </span>
          </button>
          {subject ? <SubjectTag name={subject.name} color={subject.color_key} /> : null}
          <span className="num w-10 text-right text-11 text-sub">{Math.round(p * 100)}%</span>
          {g.level === "week" ? (
            <IconButton aria-label={`${g.title} 주간 계획으로 보내기`} title="주간 계획으로 보내기" onClick={() => sendToWeek(g)}>
              <Send size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
            </IconButton>
          ) : null}
          {g.level !== "week" ? (
            <IconButton
              aria-label={`${g.title} 하위 목표 추가`}
              onClick={() =>
                setEditing({
                  goal: null,
                  defaults: {
                    level: g.level === "long" ? "month" : "week",
                    parent_id: g.id,
                    subject_id: g.subject_id,
                    start_date: g.start_date,
                    end_date: g.end_date,
                  },
                })
              }
            >
              <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
            </IconButton>
          ) : null}
        </div>
        <ProgressBar value={p} label={`${g.title} 진행률`} className="mb-1" />
        {withChildren && kids.length ? (
          <div className="mt-1">
            <SortableList items={kids} onReorder={(ids) => reorder.mutate({ ids, key: ["goals", "all", "sort_order", false] })}>
              {(c, h) => row(c, h, depth + 1)}
            </SortableList>
          </div>
        ) : null}
      </div>
    );
  };

  // 기간별 보기
  const longGoals = current.filter((g) => g.level === "long").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const months = [...new Set(current.filter((g) => g.level !== "long").map((g) => monthOf(g.start_date)))].sort();
  const thisMonth = monthOf(today);

  // 과목별 보기
  const rangeOf = (): { start: string; end: string } | null => {
    if (range === "week") return weekRange(today);
    if (range === "month") return monthRange(thisMonth);
    if (range === "semester" && profile) return semesterOf(today, profile);
    return null;
  };
  const r = rangeOf();
  const inRange = current.filter((g) => !r || overlaps({ start: g.start_date, end: g.end_date }, r));
  const subjectGroups = [
    ...(subjectList ?? []).map((s) => ({ key: s.id, name: s.name, color: s.color_key, goals: inRange.filter((g) => g.subject_id === s.id) })),
    { key: "all", name: "전체", color: null, goals: inRange.filter((g) => !g.subject_id || !subjects.has(g.subject_id)) },
  ].filter((group) => group.goals.length);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="로드맵 보기"
          value={view}
          onChange={setView}
          options={[
            { value: "period", label: "기간별" },
            { value: "subject", label: "과목별" },
          ]}
        />
        <Button onClick={() => setEditing({ goal: null, defaults: { start_date: today, end_date: weekRange(today).end } })}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          목표 추가
        </Button>
      </div>

      {view === "period" ? (
        <div role="group" aria-label="과목 거르기" className="flex flex-wrap gap-2">
          {(subjectList ?? []).map((s) => {
            const on = filter.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(on ? filter.filter((x) => x !== s.id) : [...filter, s.id])}
                className={cn(
                  "inline-flex h-chip-phone items-center gap-2 rounded-full px-3 text-13 pad:h-chip",
                  on ? "bg-chip-on text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-surface text-ink-2",
                )}
              >
                <SubjectDot color={s.color_key} />
                {s.name}
              </button>
            );
          })}
        </div>
      ) : (
        <Segmented
          label="기간 거르기"
          value={range}
          onChange={setRange}
          options={[
            { value: "week", label: "이번 주" },
            { value: "month", label: "이번 달" },
            { value: "semester", label: "이번 학기" },
            { value: "all", label: "전체" },
          ]}
        />
      )}

      {goals.length === 0 ? (
        <div className="card">
          <EmptyState message="아직 목표가 없어요" />
        </div>
      ) : view === "period" ? (
        <>
          {longGoals.length ? (
            <section className="card flex flex-col gap-2" aria-label="장기 목표">
              <h2 className="text-14 font-semibold">장기 목표</h2>
              {longGoals.map((g) => (
                <div key={g.id}>{row(g)}</div>
              ))}
            </section>
          ) : null}
          {months.map((m) => {
            const isCurrent = m === thisMonth;
            const isPast = m < thisMonth;
            const open = openMonths[m] ?? !isPast;
            const monthGoals = current.filter((g) => g.level === "month" && monthOf(g.start_date) === m);
            const monthIds = new Set(monthGoals.map((g) => g.id));
            const orphanWeeks = current.filter(
              (g) => g.level === "week" && monthOf(g.start_date) === m && !(g.parent_id && monthIds.has(g.parent_id)),
            );
            return (
              <section key={m} className={cn("card flex flex-col gap-2", isCurrent && "bg-timer-bg")} aria-label={`${m} 목표`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenMonths({ ...openMonths, [m]: !open })}
                  className="flex items-center gap-2 text-left text-14 font-semibold"
                >
                  <ChevronDown size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} className={cn(!open && "-rotate-90")} aria-hidden />
                  {Number(m.slice(5))}월{isCurrent ? <span className="text-12 font-normal text-accent-strong">이번 달</span> : null}
                </button>
                {open ? (
                  <>
                    {monthGoals.map((g) => (
                      <div key={g.id}>{row(g, undefined, 0, true)}</div>
                    ))}
                    {orphanWeeks.map((g) => (
                      <div key={g.id}>{row(g)}</div>
                    ))}
                  </>
                ) : null}
              </section>
            );
          })}
        </>
      ) : subjectGroups.length === 0 ? (
        <div className="card">
          <EmptyState message="이 기간의 목표가 없어요" />
        </div>
      ) : (
        subjectGroups.map((group) => (
          <section key={group.key} className="card flex flex-col gap-2" aria-label={`${group.name} 목표`}>
            <h2 className="flex items-center gap-2 text-14 font-semibold">
              {group.color ? <SubjectTag name={group.name} color={group.color} /> : group.name}
            </h2>
            {group.goals
              .sort((a, b) => a.start_date.localeCompare(b.start_date))
              .map((g) => (
                <div key={g.id}>{row(g)}</div>
              ))}
          </section>
        ))
      )}

      {past.length ? (
        <section className="flex flex-col gap-2">
          <button type="button" aria-expanded={showPast} onClick={() => setShowPast(!showPast)} className="self-start text-12 text-sub">
            지난 목표 {past.length}개 {showPast ? "접기" : "보기"}
          </button>
          {showPast ? (
            <div className="card flex flex-col gap-2">
              {past.map((g) => (
                <div key={g.id}>{row(g)}</div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {editing ? (
        <GoalDialog
          goal={editing.goal}
          goals={goals}
          defaults={editing.defaults}
          onClose={() => setEditing(null)}
          onSubmit={save}
          onDelete={
            editing.goal
              ? () => {
                  trash.mutate({ id: (editing.goal as GoalRow).id });
                  setEditing(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
