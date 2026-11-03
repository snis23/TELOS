"use client";

import { formatInTimeZone } from "date-fns-tz";
import { ko } from "date-fns/locale";
import { PageHeader } from "@/components/shell/page-header";
import { useTimerContext } from "@/components/timer/timer-provider";
import { useDayStartHour } from "@/lib/data/profile";
import { useTasks } from "@/lib/data/tasks";
import { useDayTimetable } from "@/lib/data/timetable";
import { TIME_ZONE } from "@/lib/date/study-date";
import { currentSlot, nextSlot } from "@/lib/timetable/resolve";
import { formatDayMin, nowDayMin } from "@/lib/timetable/time";
import { BackupReminder } from "./backup-reminder";

/** 지금 시간표 항목: "지금 야자 1차시 · 21:00까지", 없으면 "다음 야자 1차시 · 19:40부터" (5.10) */
export function useCurrentSlotLabel(): string | null {
  const { today, now } = useTimerContext();
  const dayStartHour = useDayStartHour();
  const { slots } = useDayTimetable(today);
  const nowMin = nowDayMin(now, dayStartHour);
  const slot = currentSlot(slots, nowMin);
  if (slot) return `지금 ${slot.name} · ${formatDayMin(slot.end_min, dayStartHour)}까지`;
  const next = nextSlot(slots, nowMin);
  return next ? `다음 ${next.name} · ${formatDayMin(next.start_min, dayStartHour)}부터` : null;
}

/** 실제 달력 날짜 (자정에 바뀐다): "11월 3일 화요일" */
export function formatCalendarDate(now: Date): string {
  return formatInTimeZone(now, TIME_ZONE, "M월 d일 EEEE", { locale: ko });
}

/** 5.2 머리말 제목: 다 끝내면 "오늘 할 일을 모두 끝냈어요. 수고했어요!" */
export function todayTitle(total: number, left: number): string {
  return total > 0 && left === 0 ? "오늘 할 일을 모두 끝냈어요. 수고했어요!" : `오늘 할 일 ${left}개 남았어요`;
}

/**
 * 5.2 머리말.
 * 날짜는 실제 시각 기준(자정에 바뀜)으로 보여 주고, 할 일·타이머·통계는 하루 기준 시각(기본 6시)을 쓴다.
 */
export function TodayHeader() {
  const { today, now } = useTimerContext();
  const { data: tasks } = useTasks(today);
  const left = (tasks ?? []).filter((t) => !t.done_at).length;
  const total = (tasks ?? []).length;
  return (
    <>
      <PageHeader eyebrow={formatCalendarDate(now)} title={todayTitle(total, left)} className="mb-3 pad:mb-4" />
      <BackupReminder />
    </>
  );
}
