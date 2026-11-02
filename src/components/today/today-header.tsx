"use client";

import { PageHeader } from "@/components/shell/page-header";
import { useTimerContext } from "@/components/timer/timer-provider";
import { useDayStartHour } from "@/lib/data/profile";
import { useTasks } from "@/lib/data/tasks";
import { useDayTimetable } from "@/lib/data/timetable";
import { formatStudyDateLong } from "@/lib/date/study-date";
import { currentSlot } from "@/lib/timetable/resolve";
import { formatDayMin, nowDayMin } from "@/lib/timetable/time";
import { BackupReminder } from "./backup-reminder";

/** "지금 야자 1차시 · 21:00까지" (5.10) */
export function useCurrentSlotLabel(): string | null {
  const { today, now } = useTimerContext();
  const dayStartHour = useDayStartHour();
  const { slots } = useDayTimetable(today);
  const slot = currentSlot(slots, nowDayMin(now, dayStartHour));
  return slot ? `지금 ${slot.name} · ${formatDayMin(slot.end_min, dayStartHour)}까지` : null;
}

/** 5.2 머리말 */
export function TodayHeader() {
  const { today } = useTimerContext();
  const { data: tasks } = useTasks(today);
  const slotLabel = useCurrentSlotLabel();
  const left = (tasks ?? []).filter((t) => !t.done_at).length;
  const total = (tasks ?? []).length;
  const title = total > 0 && left === 0 ? "오늘 할 일을 모두 끝냈어요" : `오늘 할 일 ${left}개 남았어요`;
  return (
    <>
      <PageHeader
        eyebrow={formatStudyDateLong(today)}
        title={title}
        sub={slotLabel}
        className="mb-4 pad:mb-6"
      />
      <BackupReminder />
    </>
  );
}
