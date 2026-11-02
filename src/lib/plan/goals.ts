import { addDays, weekStart } from "@/lib/date/days";
import type { GoalRow, ProfileRow, TaskRow } from "@/lib/supabase/database.types";

/** 6.2 로드맵 */

export const LEVEL_LABELS = { long: "장기", month: "월", week: "주" } as const;

type G = Pick<GoalRow, "id" | "parent_id" | "done_at" | "deleted_at">;
type T = Pick<TaskRow, "goal_id" | "done_at" | "deleted_at">;

/**
 * 진행률: 하위 목표가 있으면 완료한 하위 목표 비율, 없으면 연결된 할 일의 완료 비율,
 * 둘 다 없으면 직접 체크(완료 0 또는 1)
 */
export function goalProgress(goal: G, goals: readonly G[], tasks: readonly T[]): number {
  const children = goals.filter((g) => g.parent_id === goal.id && !g.deleted_at);
  if (children.length) return children.filter((g) => g.done_at).length / children.length;
  const linked = tasks.filter((t) => t.goal_id === goal.id && !t.deleted_at);
  if (linked.length) return linked.filter((t) => t.done_at).length / linked.length;
  return goal.done_at ? 1 : 0;
}

/** 끝난 기간의 미완료 목표 → "지난 목표" */
export function isPastGoal(goal: Pick<GoalRow, "end_date" | "done_at">, today: string): boolean {
  return goal.end_date < today && !goal.done_at;
}

/** 상위 목표 후보: 장기 ← 월 ← 주 */
export function parentLevel(level: GoalRow["level"]): GoalRow["level"] | null {
  return level === "week" ? "month" : level === "month" ? "long" : null;
}

/** "YYYY-MM" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthRange(month: string): { start: string; end: string } {
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, end: addDays(next, -1) };
}

export function weekRange(date: string): { start: string; end: string } {
  const start = weekStart(date);
  return { start, end: addDays(start, 6) };
}

/** 기간이 겹치는지 */
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** 6.1 학기 기간: 1학기 3/1~7/31, 2학기 8/1~다음 해 2월 말일 (설정에서 바꿀 수 있다) */
export function semesterOf(
  today: string,
  p: Pick<ProfileRow, "sem1_start" | "sem1_end" | "sem2_start" | "sem2_end">,
): { semester: 1 | 2; start: string; end: string } {
  const year = Number(today.slice(0, 4));
  const at = (y: number, md: string) => clampMonthDay(y, md);
  for (const y of [year - 1, year]) {
    const s1 = { start: at(y, p.sem1_start), end: at(y, p.sem1_end) };
    const s2start = at(y, p.sem2_start);
    const s2endYear = p.sem2_end < p.sem2_start ? y + 1 : y;
    const s2 = { start: s2start, end: at(s2endYear, p.sem2_end) };
    if (today >= s1.start && today <= s1.end) return { semester: 1, ...s1 };
    if (today >= s2.start && today <= s2.end) return { semester: 2, ...s2 };
  }
  // 학기 사이(방학)는 가장 가까운 다음 학기
  const s1 = { start: at(year, p.sem1_start), end: at(year, p.sem1_end) };
  return { semester: 1, ...s1 };
}

/** "02-29" 처럼 그해에 없는 날은 그 달 말일로 */
export function clampMonthDay(year: number, md: string): string {
  const [m, d] = md.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${year}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
