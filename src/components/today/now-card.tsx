"use client";

import { Play } from "lucide-react";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { useTimerContext } from "@/components/timer/timer-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectTag } from "@/components/ui/tag";
import { useDayStartHour } from "@/lib/data/profile";
import { useSubjectMap } from "@/lib/data/subjects";
import { useTasks } from "@/lib/data/tasks";
import { useDayTimetable } from "@/lib/data/timetable";
import { formatClock } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { pickNowTask } from "@/lib/tasks/now";
import { currentSlot, nextSlot } from "@/lib/timetable/resolve";
import { formatDayMin, nowDayMin } from "@/lib/timetable/time";

const TASK_LABEL = { now: "지금 할 일", next: "다음 할 일", todo: "남은 할 일" } as const;

/**
 * 오늘 화면 맨 위 "지금" 카드: 지금 시각 · 지금 일정(남은 시간, 진행 막대) · 지금 할 일.
 * 할 일은 바로 체크하거나 그 과목으로 타이머를 켤 수 있다.
 */
export function NowCard() {
  const timer = useTimerContext();
  const { today, now } = timer;
  const dayStartHour = useDayStartHour();
  const { slots } = useDayTimetable(today);
  const { data: tasks } = useTasks(today);
  const subjects = useSubjectMap();
  const list = tasks ?? [];
  const actions = useTaskActions(today, list);

  const nowMin = nowDayMin(now, dayStartHour);
  const slot = currentSlot(slots, nowMin);
  const next = slot ? null : nextSlot(slots, nowMin);
  const pick = pickNowTask(list, nowMin, slot?.id ?? null);
  const subject = pick?.task.subject_id ? subjects.get(pick.task.subject_id) : undefined;
  const studyingThis = Boolean(subject && timer.studying?.subject_id === subject.id);
  const clock = (m: number) => formatDayMin(m, dayStartHour);

  return (
    <section aria-label="지금" data-testid="now-card" className="rounded-card bg-timer-bg p-4.5 pad:p-6">
      <div className="grid gap-4 pad:grid-cols-[auto_minmax(0,1fr)] pad:gap-x-8 pc:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.3fr)] pc:items-center">
        <p className="num text-40 leading-none font-semibold tracking-num pad:text-44" aria-label="지금 시각">
          {formatClock(now)}
        </p>

        <div className="min-w-0" aria-label="지금 일정">
          {slot ? (
            <>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-20 font-semibold text-ink">{slot.name}</span>
                <span className="num text-12 text-sub">
                  {clock(slot.start_min)}–{clock(slot.end_min)} · {slot.end_min - nowMin}분 남음
                </span>
              </p>
              <ProgressBar
                className="mt-2"
                value={(nowMin - slot.start_min) / (slot.end_min - slot.start_min)}
                label="지금 일정 진행"
              />
            </>
          ) : next ? (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-12 text-sub">다음</span>
              <span className="text-18 font-semibold text-ink">{next.name}</span>
              <span className="num text-12 text-sub">{clock(next.start_min)}부터</span>
            </p>
          ) : (
            <p className="text-14 text-sub">오늘 남은 일정이 없어요</p>
          )}
        </div>

        <div className="rounded-item bg-surface px-3 py-2.5 pad:col-span-2 pc:col-span-1" aria-label="지금 할 일">
          <p className="mb-1 text-11 text-sub">{pick ? TASK_LABEL[pick.kind] : "지금 할 일"}</p>
          {pick ? (
            <div className="flex min-h-9 items-center gap-2">
              <Checkbox checked={false} onChange={() => actions.toggleDone(pick.task, true)} label={`${pick.task.title} 끝내기`} />
              {subject ? <SubjectTag name={subject.name} color={subject.color_key} /> : null}
              <span className="min-w-0 flex-1 truncate text-15 font-medium text-ink">{pick.task.title}</span>
              {pick.task.start_min != null ? <span className="num shrink-0 text-11 text-sub">{clock(pick.task.start_min)}</span> : null}
              {subject && !studyingThis ? (
                <button
                  type="button"
                  onClick={() => timer.startSubject(subject.id)}
                  aria-label={`${subject.name} 타이머 시작`}
                  className="hit inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-btn text-btn-ink"
                >
                  <Play size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} fill="currentColor" aria-hidden className="translate-x-px" />
                </button>
              ) : null}
            </div>
          ) : (
            <p className="py-1.5 text-13 text-sub">할 일이 없어요. 할 일을 추가하거나 로드맵에서 가져와요</p>
          )}
        </div>
      </div>
    </section>
  );
}
