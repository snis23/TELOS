import { diffDays } from "@/lib/date/days";
import type { DdayRow } from "@/lib/supabase/database.types";

/** 5.3 D-day */

export const HOME_DDAY_LIMIT = 4;

export function daysLeft(date: string, today: string): number {
  return diffDays(today, date);
}

/** "D-5", 당일 "D-DAY", 지나면 "D+3" */
export function ddayLabel(date: string, today: string): string {
  const n = daysLeft(date, today);
  if (n === 0) return "D-DAY";
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

export type Urgency = "urgent" | "warn" | "normal";

/** 7일 이하 긴급, 8~14일 주의, 15일 이상 보통 (고정 여부와 상관없다) */
export function urgency(date: string, today: string): Urgency {
  const n = daysLeft(date, today);
  if (n <= 7) return "urgent";
  if (n <= 14) return "warn";
  return "normal";
}

type D = Pick<DdayRow, "id" | "date" | "type" | "status" | "pinned" | "pin_order" | "deleted_at">;

/** 지난 일정과 완료한 수행평가는 뺀다 */
export function isUpcoming(d: D, today: string): boolean {
  if (d.deleted_at) return false;
  if (d.date < today) return false;
  if (d.type === "performance" && d.status === "done") return false;
  return true;
}

/** 홈 D-day: 고정한 것 먼저(고정 순서), 남은 칸은 날짜가 가까운 순, 최대 4개 */
export function selectHomeDdays<X extends D>(ddays: readonly X[], today: string, limit = HOME_DDAY_LIMIT): X[] {
  const upcoming = ddays.filter((d) => isUpcoming(d, today));
  const pinned = upcoming.filter((d) => d.pinned).sort((a, b) => a.pin_order - b.pin_order || a.date.localeCompare(b.date));
  const rest = upcoming.filter((d) => !d.pinned).sort((a, b) => a.date.localeCompare(b.date));
  return [...pinned, ...rest].slice(0, limit);
}

/** 7일 이내 D-day 가 있는지 (시험 메뉴 점) */
export function hasUrgent(ddays: readonly D[], today: string): boolean {
  return ddays.some((d) => isUpcoming(d, today) && daysLeft(d.date, today) <= 7);
}

/** 준비율: 시험은 범위 진행률, 수행평가는 상태, 기타는 숨김(null) */
export function prepPercent(
  d: Pick<DdayRow, "type" | "status" | "prep_percent">,
  examProgress: number | null,
): number | null {
  if (d.type === "exam") return examProgress === null ? null : Math.round(examProgress * 100);
  if (d.type === "performance") {
    if (d.status === "todo") return 0;
    if (d.status === "done") return 100;
    return d.prep_percent ?? 0;
  }
  return null;
}
