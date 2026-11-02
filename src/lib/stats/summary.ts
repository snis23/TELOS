import { addDays, diffDays, weekStart } from "@/lib/date/days";
import type { DailyStatRow, TaskDeferralRow, TaskRow } from "@/lib/supabase/database.types";

/** 8.1 기록 화면 계산 */

export type DayTotal = {
  date: string;
  study: number;
  bySubject: Map<string, number>;
  nap: number;
  napCount: number;
  planned: number;
  done: number;
};

/** daily_stats 행들을 날짜별 합계로 */
export function totalsFromStats(rows: readonly Pick<DailyStatRow, "study_date" | "subject_id" | "study_seconds" | "nap_seconds" | "nap_count" | "planned_tasks" | "done_tasks">[]): Map<string, DayTotal> {
  const map = new Map<string, DayTotal>();
  for (const r of rows) {
    const t = map.get(r.study_date) ?? { date: r.study_date, study: 0, bySubject: new Map(), nap: 0, napCount: 0, planned: 0, done: 0 };
    t.study += r.study_seconds;
    if (r.subject_id) t.bySubject.set(r.subject_id, (t.bySubject.get(r.subject_id) ?? 0) + r.study_seconds);
    t.nap += r.nap_seconds;
    t.napCount += r.nap_count;
    t.planned += r.planned_tasks;
    t.done += r.done_tasks;
    map.set(r.study_date, t);
  }
  return map;
}

export type Period = "day" | "week" | "month";

/** 기간: 일 = 오늘, 주 = 이번 주 월요일~오늘, 월 = 이번 달 1일~오늘 */
export function periodRange(period: Period, today: string): { from: string; to: string } {
  if (period === "day") return { from: today, to: today };
  if (period === "week") return { from: weekStart(today), to: today };
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function sumTotals(days: readonly DayTotal[]): DayTotal & { days: number } {
  const out: DayTotal & { days: number } = { date: "", study: 0, bySubject: new Map(), nap: 0, napCount: 0, planned: 0, done: 0, days: days.length };
  for (const d of days) {
    out.study += d.study;
    out.nap += d.nap;
    out.napCount += d.napCount;
    out.planned += d.planned;
    out.done += d.done;
    for (const [k, v] of d.bySubject) out.bySubject.set(k, (out.bySubject.get(k) ?? 0) + v);
  }
  return out;
}

/** 실행률 = 끝낸 할 일 수 ÷ 할 일 수 (넘긴 할 일은 원래 날짜에서도 분모에) */
export function executionRate(planned: number, done: number): number | null {
  return planned > 0 ? done / planned : null;
}

/** 오늘 할 일 수 (실시간): 지금 그날 할 일 + 그날에서 다른 날로 넘긴 할 일 */
export function todayPlanned(
  tasks: readonly Pick<TaskRow, "id" | "done_at" | "deleted_at">[],
  deferralsFromToday: readonly Pick<TaskDeferralRow, "id" | "task_id">[],
): { planned: number; done: number } {
  const live = tasks.filter((t) => !t.deleted_at);
  const ids = new Set(live.map((t) => t.id));
  const moved = new Set(deferralsFromToday.filter((d) => !(d.task_id && ids.has(d.task_id))).map((d) => d.task_id ?? d.id));
  return { planned: live.length + moved.size, done: live.filter((t) => t.done_at).length };
}

/** 공부 잔디 단계: 0시간, 1시간 미만, 3시간 미만, 5시간 미만, 5시간 이상 */
export function grassLevel(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  if (seconds < 3600) return 1;
  if (seconds < 3 * 3600) return 2;
  if (seconds < 5 * 3600) return 3;
  return 4;
}

/** 잔디 칸: 최근 16주, 7행(월~일). 맨 오른쪽 열이 이번 주 */
export function grassDays(today: string, weeks = 16): string[][] {
  const start = addDays(weekStart(today), -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export const STREAK_MIN_SECONDS = 30 * 60;

/** 연속 달성일: 순공 30분 이상인 날이 오늘(또는 어제)까지 이어진 일 수 */
export function streak(studyByDate: ReadonlyMap<string, number>, today: string): number {
  const ok = (d: string) => (studyByDate.get(d) ?? 0) >= STREAK_MIN_SECONDS;
  let day = ok(today) ? today : addDays(today, -1);
  let n = 0;
  while (ok(day) && n < 3650) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

/** 미루기 분석 (최근 30일) */
export function deferralAnalysis(
  deferrals: readonly Pick<TaskDeferralRow, "title" | "subject_id" | "from_date">[],
  recurringTasks: readonly Pick<TaskRow, "recurrence_id" | "done_at" | "study_date" | "deleted_at">[],
  today: string,
) {
  const from = addDays(today, -30);
  const recent = deferrals.filter((d) => d.from_date >= from && d.from_date <= today);
  const bySubject = new Map<string | null, number>();
  const byTitle = new Map<string, number>();
  for (const d of recent) {
    bySubject.set(d.subject_id, (bySubject.get(d.subject_id) ?? 0) + 1);
    byTitle.set(d.title, (byTitle.get(d.title) ?? 0) + 1);
  }
  const top = [...byTitle.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  // 반복 할 일별 못 한 비율: 지난 30일(오늘 제외)에 만들어진 그 반복 할 일 중 안 끝낸 비율
  const byRec = new Map<string, { total: number; missed: number }>();
  for (const t of recurringTasks) {
    if (!t.recurrence_id || t.deleted_at || t.study_date >= today || t.study_date < from) continue;
    const r = byRec.get(t.recurrence_id) ?? { total: 0, missed: 0 };
    r.total += 1;
    if (!t.done_at) r.missed += 1;
    byRec.set(t.recurrence_id, r);
  }
  return { total: recent.length, bySubject, top, recurrenceMissed: byRec };
}

/** 최근 n일 날짜 (오래된 날부터) */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

export function daysBetween(from: string, to: string): number {
  return diffDays(from, to) + 1;
}
