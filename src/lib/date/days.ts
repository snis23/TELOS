import { formatInTimeZone } from "date-fns-tz";
import { ko } from "date-fns/locale";
import { TIME_ZONE } from "./study-date";

/** "YYYY-MM-DD" 날짜 계산 (시간대 영향 없이 달력 날짜만 다룬다) */

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** b - a (일) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** ISO 요일: 1 = 월요일 … 7 = 일요일 */
export function isoWeekday(date: string): number {
  const d = toUtc(date).getUTCDay();
  return d === 0 ? 7 : d;
}

/** 그 주 월요일 */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export const WEEKDAY_SHORT = ["월", "화", "수", "목", "금", "토", "일"] as const;

function noon(date: string): Date {
  return new Date(`${date}T12:00:00+09:00`);
}

/** "11월 7일" */
export function formatMonthDay(date: string): string {
  return formatInTimeZone(noon(date), TIME_ZONE, "M월 d일", { locale: ko });
}

/** "12월 8일 (화)" */
export function formatMonthDayWeekday(date: string): string {
  return `${formatMonthDay(date)} (${WEEKDAY_SHORT[isoWeekday(date) - 1]})`;
}

/** 한국 시간 "HH:mm" */
export function formatClock(instant: Date | string): string {
  return formatInTimeZone(typeof instant === "string" ? new Date(instant) : instant, TIME_ZONE, "HH:mm");
}

/** 날짜 범위 [from, to] 안의 모든 날짜 */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
