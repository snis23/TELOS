"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectTag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { useDdays, useRoadmapItems } from "@/lib/data/ddays";
import { useSubjectMap } from "@/lib/data/subjects";
import { useTaskMutations, useTasksRange } from "@/lib/data/tasks";
import { useToday } from "@/lib/data/today";
import { WEEKDAY_SHORT, addDays, eachDay, formatMonthDay, weekStart } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { SubjectRow, TaskRow } from "@/lib/supabase/database.types";
import { sortTasks } from "@/lib/tasks/defer";
import { useLayout } from "@/lib/use-layout";

/**
 * 6.3 주간 계획: 한 주는 월요일부터. 위에 그 주의 시험 대비 로드맵 계획 요약, 아래에 요일별 할 일.
 * 패드 가로·PC 는 7열, 패드 세로·폰은 요일별 세로 목록.
 * 패드와 PC 에서는 할 일을 다른 요일로 끌어 옮길 수 있다 (미룬 횟수는 오르지 않음).
 */
export function WeeklyPlan() {
  const today = useToday();
  const layout = useLayout();
  const [anchor, setAnchor] = useState(today);
  const week = { start: weekStart(anchor), end: addDays(weekStart(anchor), 6) };
  const days = eachDay(week.start, week.end);
  const { data: tasks } = useTasksRange(week.start, week.end);
  const { data: ddays } = useDdays();
  const { data: roadmap } = useRoadmapItems();
  const subjects = useSubjectMap();
  const { update } = useTaskMutations();
  const [adding, setAdding] = useState<string | null>(null);
  const actions = useTaskActions(adding ?? today, []);
  const canDrag = layout !== "phone";
  const columns = layout === "land" || layout === "pc";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );

  // 이 주에 로드맵 계획이 있는 시험별: 끝낸 칸 / 전체 칸
  const weekItems = (roadmap ?? []).filter((i) => i.study_date >= week.start && i.study_date <= week.end);
  const weekExams = (ddays ?? [])
    .filter((d) => d.type === "exam")
    .map((d) => {
      const list = weekItems.filter((i) => i.dday_id === d.id);
      return { exam: d, total: list.length, done: list.filter((i) => i.done_at).length };
    })
    .filter((x) => x.total > 0);
  const byDay = new Map<string, TaskRow[]>(days.map((d) => [d, sortTasks((tasks ?? []).filter((t) => t.study_date === d))]));

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    const task = (tasks ?? []).find((t) => t.id === id);
    if (!task || !to || task.study_date === to) return;
    // 주간 계획에서 옮기는 것은 미루기가 아니라 계획 바꾸기: 시간 블록만 비운다
    update.mutate({ ids: [id], patch: { study_date: to, start_min: null, end_min: null, slot_id: null } });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton aria-label="지난주" onClick={() => setAnchor(addDays(week.start, -7))}>
            <ChevronLeft size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
          </IconButton>
          <span className="text-14 font-semibold">
            {formatMonthDay(week.start)} – {formatMonthDay(week.end)}
          </span>
          <IconButton aria-label="다음 주" onClick={() => setAnchor(addDays(week.start, 7))}>
            <ChevronRight size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
          </IconButton>
        </div>
        {anchor !== today ? (
          <button type="button" className="text-12 text-accent" onClick={() => setAnchor(today)}>
            이번 주로
          </button>
        ) : null}
      </div>

      <section className="card flex flex-col gap-2" aria-label="이번 주 시험 대비">
        <h2 className="text-14 font-semibold">이번 주 시험 대비 계획</h2>
        {weekExams.length === 0 ? (
          <p className="text-13 text-sub">이 주의 로드맵 계획이 없어요. 시험 대비 화면의 달력에 적을 수 있어요</p>
        ) : (
          weekExams.map(({ exam, total, done }) => (
            <div key={exam.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-13 text-ink-2">{exam.title}</span>
              <ProgressBar value={done / total} label={`${exam.title} 이번 주 진행률`} className="max-w-32" />
              <span className="num w-12 text-right text-11 text-sub">
                {done}/{total}
              </span>
            </div>
          ))
        )}
      </section>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className={cn("grid gap-3", columns ? "grid-cols-7" : "grid-cols-1")} data-testid="week-grid">
          {days.map((d, i) => (
            <DayColumn
              key={d}
              date={d}
              label={`${WEEKDAY_SHORT[i]} ${formatMonthDay(d)}`}
              isToday={d === today}
              tasks={byDay.get(d) ?? []}
              subjects={subjects}
              canDrag={canDrag}
              compact={columns}
              onToggle={(t, v) => actions.toggleDone(t, v)}
              onAdd={() => setAdding(d)}
            />
          ))}
        </div>
      </DndContext>

      <TaskDialog
        open={adding !== null}
        onClose={() => setAdding(null)}
        defaults={{ study_date: adding ?? today }}
        onSubmit={(v) => void actions.add(v)}
      />
    </div>
  );
}

function DayColumn({
  date,
  label,
  isToday,
  tasks,
  subjects,
  canDrag,
  compact,
  onToggle,
  onAdd,
}: {
  date: string;
  label: string;
  isToday: boolean;
  tasks: TaskRow[];
  subjects: ReadonlyMap<string, SubjectRow>;
  canDrag: boolean;
  compact: boolean;
  onToggle: (t: TaskRow, done: boolean) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      data-date={date}
      className={cn(
        "flex min-h-24 min-w-0 flex-col gap-1 rounded-item bg-surface p-3 transition-colors",
        isToday && "bg-timer-bg",
        isOver && "outline-2 outline-check",
      )}
    >
      <header className="mb-1 flex items-center justify-between gap-1">
        <h3 className={cn("text-12", isToday ? "font-semibold text-accent-strong" : "text-sub")}>{label}</h3>
        <button type="button" onClick={onAdd} aria-label={`${label} 할 일 추가`} className="hit inline-flex size-6 items-center justify-center rounded-input text-sub hover:text-ink">
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
        </button>
      </header>
      {tasks.length === 0 ? <p className="text-11 text-sub">할 일 없음</p> : null}
      {tasks.map((t) => (
        <WeekTask key={t.id} task={t} subject={t.subject_id ? subjects.get(t.subject_id) : undefined} canDrag={canDrag} compact={compact} onToggle={onToggle} />
      ))}
    </section>
  );
}

function WeekTask({
  task,
  subject,
  canDrag,
  compact,
  onToggle,
}: {
  task: TaskRow;
  subject?: SubjectRow;
  canDrag: boolean;
  compact: boolean;
  onToggle: (t: TaskRow, done: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canDrag });
  const done = Boolean(task.done_at);
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "flex min-h-8 items-start gap-1.5 rounded-input bg-surface py-1 pr-1",
        isDragging && "relative z-10 outline-2 outline-check",
        canDrag && "touch-none",
      )}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      aria-roledescription={canDrag ? "끌어서 다른 요일로 옮기기" : undefined}
      data-testid="week-task"
    >
      <Checkbox checked={done} onChange={(v) => onToggle(task, v)} label={`${task.title} 완료`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
        {subject && !compact ? <SubjectTag name={subject.name} color={subject.color_key} className="self-start" /> : null}
        <span className={cn("text-12 break-words", done ? "text-sub line-through" : "text-ink-2")}>
          {subject && compact ? <span data-subject={subject.color_key} className="mr-1 inline-block size-chip-dot rounded-full bg-s-dot align-middle" /> : null}
          {task.title}
        </span>
      </div>
    </div>
  );
}

