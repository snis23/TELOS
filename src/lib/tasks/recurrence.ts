import { addDays, diffDays, isoWeekday, weekStart, WEEKDAY_SHORT } from "@/lib/date/days";
import type { RecurrenceRule } from "@/lib/supabase/database.types";

/** 5.6 반복 할 일: 매일 / 요일 선택 / 격주 (start_date 가 있는 주부터 2주마다) */

export type RecurrenceLike = {
  rule: RecurrenceRule;
  start_date: string;
  end_date: string | null;
};

export function occursOn(rec: RecurrenceLike, date: string): boolean {
  if (date < rec.start_date) return false;
  if (rec.end_date && date > rec.end_date) return false;
  const rule = rec.rule;
  if (rule.type === "daily") return true;
  const weekday = isoWeekday(date);
  if (!rule.days.includes(weekday)) return false;
  if (rule.type === "weekdays") return true;
  const weeks = diffDays(weekStart(rec.start_date), weekStart(date)) / 7;
  return weeks % 2 === 0;
}

/** 반복 표시: "매일", "월·수·금", "격주 화·목" */
export function ruleLabel(rule: RecurrenceRule): string {
  if (rule.type === "daily") return "매일";
  const days = [...rule.days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d - 1]).join("·");
  return rule.type === "biweekly" ? `격주 ${days}` : days;
}

/**
 * 연속으로 못 한 횟수: 오늘 이전의 예정일을 거꾸로 세며, 끝낸 날을 만나면 멈춘다.
 * (앱을 열지 않아 할 일이 만들어지지 않은 날도 못 한 것으로 센다)
 */
export function missedStreak(rec: RecurrenceLike, today: string, doneDates: ReadonlySet<string>, limit = 60): number {
  let streak = 0;
  let date = addDays(today, -1);
  for (let i = 0; i < 400 && streak < limit; i += 1) {
    if (date < rec.start_date) break;
    if (occursOn(rec, date)) {
      if (doneDates.has(date)) break;
      streak += 1;
    }
    date = addDays(date, -1);
  }
  return streak;
}

/** 그날 만들어야 할 반복 할 일 (이미 있는 것은 건너뛴다: 같은 반복·같은 날짜는 하나만) */
export function recurrencesDue<R extends RecurrenceLike & { id: string }>(
  recs: readonly R[],
  date: string,
  existingRecurrenceIds: ReadonlySet<string>,
): R[] {
  return recs.filter((r) => occursOn(r, date) && !existingRecurrenceIds.has(r.id));
}
