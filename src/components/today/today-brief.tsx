"use client";

import { Clock, Quote as QuoteIcon } from "lucide-react";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { useTimerContext } from "@/components/timer/timer-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { SubjectTag } from "@/components/ui/tag";
import { useDayStartHour } from "@/lib/data/profile";
import { useSubjectMap } from "@/lib/data/subjects";
import { useTasks } from "@/lib/data/tasks";
import { useDayTimetable } from "@/lib/data/timetable";
import { formatClock } from "@/lib/date/days";
import { ICON_STROKE } from "@/lib/design/icons";
import { quoteOfDay } from "@/lib/quotes";
import { pickNowTask } from "@/lib/tasks/now";
import { currentSlot } from "@/lib/timetable/resolve";
import { formatDayMin, nowDayMin } from "@/lib/timetable/time";
import { useCurrentSlotLabel } from "./today-header";

const KIND_LABEL = { now: "지금 할 일", next: "다음 할 일", todo: "남은 할 일" } as const;

/** 오늘 화면 맨 위: 오늘의 명언, 지금 시각과 차시, 지금 해야 할 일 */
export function TodayBrief() {
  const { today, now } = useTimerContext();
  const dayStartHour = useDayStartHour();
  const { slots } = useDayTimetable(today);
  const { data: tasks } = useTasks(today);
  const subjects = useSubjectMap();
  const list = tasks ?? [];
  const actions = useTaskActions(today, list);
  const slotLabel = useCurrentSlotLabel();
  const nowMin = nowDayMin(now, dayStartHour);
  const slot = currentSlot(slots, nowMin);
  const pick = pickNowTask(list, nowMin, slot?.id ?? null);
  const quote = quoteOfDay(today);
  const subject = pick?.task.subject_id ? subjects.get(pick.task.subject_id) : undefined;

  return (
    <section aria-label="오늘의 명언과 지금 할 일" className="card mb-6 flex flex-col gap-4 pad:mb-8">
      <figure className="flex gap-2.5">
        <QuoteIcon size={16} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-sub" aria-hidden />
        <div>
          <blockquote className="text-14 font-medium text-ink">{quote.text}</blockquote>
          <figcaption className="mt-1 text-12 text-sub">{quote.by}</figcaption>
        </div>
      </figure>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        <p className="flex items-center gap-2">
          <Clock size={16} strokeWidth={ICON_STROKE} className="text-sub" aria-hidden />
          <span className="num text-22 font-semibold" aria-label="지금 시각">
            {formatClock(now)}
          </span>
        </p>
        {slotLabel ? <p className="text-13 text-ink-2">{slotLabel}</p> : null}
      </div>
      {pick ? (
        <div className="flex items-center gap-2 rounded-input bg-surface-2 px-3 py-2">
          <Checkbox
            checked={false}
            onChange={() => actions.toggleDone(pick.task, true)}
            label={`${pick.task.title} 끝내기`}
          />
          <span className="text-12 text-sub">{KIND_LABEL[pick.kind]}</span>
          {subject ? <SubjectTag name={subject.name} color={subject.color_key} /> : null}
          <span className="min-w-0 flex-1 truncate text-14 text-ink">{pick.task.title}</span>
          {pick.task.start_min != null ? (
            <span className="num text-11 text-sub">{formatDayMin(pick.task.start_min, dayStartHour)}</span>
          ) : null}
        </div>
      ) : (
        <p className="text-13 text-sub">지금 할 일이 없어요. 할 일을 추가하거나 로드맵에서 가져오세요.</p>
      )}
    </section>
  );
}
