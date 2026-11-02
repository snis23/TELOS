import { isoWeekday } from "@/lib/date/days";
import type { DateTimetableRow, HolidayRow, TimetableRow, TimetableSlotRow } from "@/lib/supabase/database.types";

/**
 * 5.10 날짜별 시간표: 날짜 지정 > 공휴일(주말·공휴일) > 토·일(주말·공휴일) > 월~금(평일)
 */
export function timetableForDate(
  date: string,
  data: {
    timetables: readonly Pick<TimetableRow, "id" | "default_for" | "deleted_at">[];
    holidays: readonly Pick<HolidayRow, "date" | "deleted_at">[];
    dateTimetables: readonly Pick<DateTimetableRow, "date" | "timetable_id" | "deleted_at">[];
  },
): string | null {
  const live = data.timetables.filter((t) => !t.deleted_at);
  const ids = new Set(live.map((t) => t.id));
  const specific = data.dateTimetables.find((d) => !d.deleted_at && d.date === date && ids.has(d.timetable_id));
  if (specific) return specific.timetable_id;
  const isHoliday = data.holidays.some((h) => !h.deleted_at && h.date === date);
  const weekend = isHoliday || isoWeekday(date) >= 6;
  const kind = weekend ? "weekend" : "weekday";
  return live.find((t) => t.default_for === kind)?.id ?? null;
}

export function slotsOf(timetableId: string | null, slots: readonly TimetableSlotRow[]): TimetableSlotRow[] {
  if (!timetableId) return [];
  return slots.filter((s) => s.timetable_id === timetableId && !s.deleted_at).sort((a, b) => a.start_min - b.start_min);
}

/** 지금 일정: "지금 야자 1차시 · 21:00까지" */
export function currentSlot<S extends Pick<TimetableSlotRow, "start_min" | "end_min">>(slots: readonly S[], nowMin: number): S | null {
  return slots.find((s) => s.start_min <= nowMin && nowMin < s.end_min) ?? null;
}

export const CATEGORY_LABELS = {
  class: "수업 교시",
  study: "자습·야자 차시",
  meal: "식사",
  life: "생활",
} as const;
