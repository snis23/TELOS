import { addDays, isoWeekday } from "@/lib/date/days";
import type { RangeItemRow, RangeUnit } from "@/lib/supabase/database.types";

/**
 * 6.5 범위 분배
 * 1. 남은 양 = 전체 양 − 끝낸 양
 * 2. 공부 가능일 = 오늘부터 (그 과목 시험일 − 총복습 기간 − 1일)까지, 공부 안 하는 요일 제외
 * 3. 하루 분량 = 남은 양 ÷ 공부 가능일, 올림
 * 4. 오늘 분량 = 현재 위치부터 하루 분량만큼
 * 5. 공부 가능일이 0 이하이면 "총복습 기간이에요"
 */

type Item = Pick<RangeItemRow, "start_no" | "end_no" | "done_amount">;

export function totalAmount(item: Item): number {
  return Math.max(0, item.end_no - item.start_no + 1);
}

export function doneAmount(item: Item): number {
  return Math.min(Math.max(0, item.done_amount), totalAmount(item));
}

export function remainingAmount(item: Item): number {
  return totalAmount(item) - doneAmount(item);
}

export function itemProgress(item: Item): number {
  const total = totalAmount(item);
  return total === 0 ? 1 : doneAmount(item) / total;
}

/** 공부 가능일 수 */
export function studyDays(today: string, examDate: string, reviewDays: number, offWeekdays: readonly number[]): number {
  const last = addDays(examDate, -reviewDays - 1);
  let count = 0;
  for (let d = today; d <= last; d = addDays(d, 1)) {
    if (!offWeekdays.includes(isoWeekday(d))) count += 1;
  }
  return count;
}

export type TodayPortion =
  | { kind: "portion"; from: number; to: number; perDay: number; days: number }
  | { kind: "review" }
  | { kind: "done" }
  | { kind: "off" };

/** 오늘 분량 */
export function todayPortion(
  item: Item,
  opts: { today: string; examDate: string; reviewDays: number; offWeekdays: readonly number[] },
): TodayPortion {
  const remaining = remainingAmount(item);
  if (remaining <= 0) return { kind: "done" };
  const days = studyDays(opts.today, opts.examDate, opts.reviewDays, opts.offWeekdays);
  if (days <= 0) return { kind: "review" };
  if (opts.offWeekdays.includes(isoWeekday(opts.today))) return { kind: "off" };
  const perDay = Math.ceil(remaining / days);
  const from = item.start_no + doneAmount(item);
  const to = Math.min(item.end_no, from + perDay - 1);
  return { kind: "portion", from, to, perDay, days };
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 과목 진행률 = 항목 진행률 평균 */
export function subjectProgress(items: readonly Item[]): number | null {
  return average(items.map(itemProgress));
}

/** 시험 진행률 = 과목 진행률 평균 */
export function examProgress(items: readonly (Item & { subject_id: string })[]): number | null {
  const bySubject = new Map<string, Item[]>();
  for (const it of items) bySubject.set(it.subject_id, [...(bySubject.get(it.subject_id) ?? []), it]);
  return average([...bySubject.values()].map((list) => subjectProgress(list) ?? 0));
}

export const UNIT_LABELS: Record<RangeUnit, string> = {
  page: "쪽",
  unit: "단원",
  chapter: "장",
  problem: "문제",
};

/** "p.84–97", "3–4단원", "5장", "12–30번" */
export function formatRange(unit: RangeUnit, from: number, to: number): string {
  const span = from === to ? `${from}` : `${from}–${to}`;
  switch (unit) {
    case "page":
      return `p.${span}`;
    case "unit":
      return `${span}단원`;
    case "chapter":
      return `${span}장`;
    case "problem":
      return `${span}번`;
  }
}
