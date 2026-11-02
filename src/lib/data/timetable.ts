"use client";

import { useMemo } from "react";
import { slotsOf, timetableForDate } from "@/lib/timetable/resolve";
import type { TimetableSlotRow } from "@/lib/supabase/database.types";
import { useAllRows } from "./queries";

export function useTimetables() {
  return useAllRows("timetables", { orderBy: "sort_order" });
}
export function useSlots() {
  return useAllRows("timetable_slots", { orderBy: "start_min" });
}
export function useHolidays() {
  return useAllRows("holidays", { orderBy: "date" });
}
export function useDateTimetables() {
  return useAllRows("date_timetables", { orderBy: "date" });
}

/** 그날 적용되는 시간표와 항목 */
export function useDayTimetable(date: string): { timetableId: string | null; slots: TimetableSlotRow[]; ready: boolean } {
  const timetables = useTimetables();
  const slots = useSlots();
  const holidays = useHolidays();
  const dates = useDateTimetables();
  return useMemo(() => {
    const ready = Boolean(timetables.data && slots.data && holidays.data && dates.data);
    const id = timetableForDate(date, {
      timetables: timetables.data ?? [],
      holidays: holidays.data ?? [],
      dateTimetables: dates.data ?? [],
    });
    return { timetableId: id, slots: slotsOf(id, slots.data ?? []), ready };
  }, [date, timetables.data, slots.data, holidays.data, dates.data]);
}
