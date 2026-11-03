"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";
import { RoadmapPicker } from "@/components/roadmap/roadmap-picker";
import { RoadmapPusher } from "@/components/roadmap/roadmap-pusher";
import { useTimerContext } from "@/components/timer/timer-provider";
import { Button, IconButton } from "@/components/ui/button";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableList } from "@/components/ui/sortable";
import { useDayStartHour } from "@/lib/data/profile";
import { useSubjectMap } from "@/lib/data/subjects";
import { useDaySessions } from "@/lib/data/timer";
import { useDayTimetable } from "@/lib/data/timetable";
import { useRecurrences, useStaleTasks, useTasks } from "@/lib/data/tasks";
import { addDays, formatMonthDayWeekday } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import type { TaskRow } from "@/lib/supabase/database.types";
import { bulkDeferTargets, sortTasks } from "@/lib/tasks/defer";
import { nowDayMin } from "@/lib/timetable/time";
import { ScopeDialog } from "./scope-dialog";
import { SlotView } from "./slot-view";
import { SplitDialog } from "./split-dialog";
import { TaskDialog, type TaskFormValues } from "./task-dialog";
import { TaskItem } from "./task-item";
import { TimeGrid } from "./time-grid";
import { useTaskActions, type Scope } from "./use-task-actions";

type View = "list" | "time" | "slot";
const VIEW_KEY = "telos:task-view";
const STALE_KEY = "telos:stale-dismissed";
const VIEWS: readonly { value: View; label: string }[] = [
  { value: "list", label: "목록" },
  { value: "time", label: "시간" },
  { value: "slot", label: "시간표" },
];

function readView(): View {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "time" || v === "slot" ? v : "list";
  } catch {
    return "list";
  }
}

type Pending = { kind: "edit"; task: TaskRow; values: TaskFormValues } | { kind: "delete"; task: TaskRow } | null;

/** 5.6 오늘 할 일 카드 + 5.11 하루 시간표 (목록 | 시간 | 시간표) */
export function TaskCard() {
  const { today, now } = useTimerContext();
  const [date, setDate] = useState<string | null>(null);
  const viewDate = date ?? today;
  const isToday = viewDate === today;
  const dayStartHour = useDayStartHour();
  const subjects = useSubjectMap();
  const { data: tasksData, isPending } = useTasks(viewDate);
  const { data: recurrences } = useRecurrences();
  const { data: stale } = useStaleTasks(today);
  const { slots } = useDayTimetable(viewDate);
  const sessions = useDaySessions(viewDate);
  const tasks = useMemo(() => sortTasks(tasksData ?? []), [tasksData]);
  const actions = useTaskActions(viewDate, tasks);
  const recurrenceMap = useMemo(() => new Map((recurrences ?? []).map((r) => [r.id, r])), [recurrences]);

  const [view, setViewState] = useState<View>(readView);
  const [dialog, setDialog] = useState<{ task?: TaskRow; defaults?: Partial<TaskRow> } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [splitting, setSplitting] = useState<TaskRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pusherOpen, setPusherOpen] = useState(false);
  const [staleDismissed, setStaleDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(STALE_KEY) === today;
    } catch {
      return false;
    }
  });

  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // 무시
    }
  };

  const done = tasks.filter((t) => t.done_at).length;
  const deferTargets = isToday ? bulkDeferTargets(tasks) : [];
  const staleList = isToday && !staleDismissed ? (stale ?? []) : [];

  const openAdd = (defaults?: Partial<TaskRow>) => setDialog({ defaults: { study_date: viewDate, ...defaults } });
  const askDelete = (task: TaskRow) => (task.recurrence_id ? setPending({ kind: "delete", task }) : void actions.remove(task));

  // 단축키 (4.3): A 추가, Shift+D 넘기기, V 보기 전환, ← → 하루 시간표 날짜 이동
  useShortcut({ code: "KeyA" }, () => openAdd());
  useShortcut({ code: "KeyD", shift: true }, () => {
    if (deferTargets.length) actions.deferMany(deferTargets.map((t) => t.id));
  });
  useShortcut({ code: "KeyV" }, () => setView(VIEWS[(VIEWS.findIndex((v) => v.value === view) + 1) % VIEWS.length].value));
  useShortcut([{ code: "ArrowLeft" }, { code: "ArrowRight" }], (_e, i) => setDate(addDays(viewDate, i === 0 ? -1 : 1)), {
    enabled: view === "time",
  });

  const title = isToday ? "오늘 할 일" : `${formatMonthDayWeekday(viewDate)} 할 일`;

  return (
    <section aria-label={title} className="card flex flex-col gap-4" data-testid="task-card">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="whitespace-nowrap text-14 font-semibold">
            {title}{" "}
            <span className="num font-medium text-sub" data-testid="task-count">
              {done}/{tasks.length}
            </span>
          </h2>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Button variant="secondary" pill onClick={() => setPickerOpen(true)}>
              <CalendarRange size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
              로드맵에서
            </Button>
            <Button variant="secondary" pill onClick={() => setPusherOpen(true)}>
              <Upload size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
              로드맵으로
            </Button>
            <Button variant="primary" pill onClick={() => openAdd()} aria-keyshortcuts="A">
              <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
              추가
            </Button>
          </div>
        </div>
        <ProgressBar value={tasks.length ? done / tasks.length : 0} label="할 일 진행률" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented label="할 일 보기" value={view} options={VIEWS} onChange={setView} />
          <div className="flex items-center gap-1">
            <IconButton aria-label="전날" onClick={() => setDate(addDays(viewDate, -1))}>
              <ChevronLeft size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
            </IconButton>
            {!isToday ? (
              <button type="button" className="text-12 text-accent" onClick={() => setDate(null)}>
                오늘로
              </button>
            ) : null}
            <IconButton aria-label="다음 날" onClick={() => setDate(addDays(viewDate, 1))}>
              <ChevronRight size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
            </IconButton>
          </div>
        </div>
      </header>

      {staleList.length ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-input bg-warn-bg px-3 py-2 text-13 text-warn-ink">
          <span className="mr-auto">지난 할 일 {staleList.length}개를 못 끝냈어요</span>
          <button type="button" className="font-semibold" onClick={() => actions.bringToToday(staleList.map((t) => t.id))}>
            오늘로 가져오기
          </button>
          <button
            type="button"
            onClick={() => {
              setStaleDismissed(true);
              try {
                window.localStorage.setItem(STALE_KEY, today);
              } catch {
                // 무시
              }
            }}
          >
            그대로 두기
          </button>
        </div>
      ) : null}

      <CardErrorBoundary>
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : view === "time" ? (
          <TimeGrid
            date={viewDate}
            now={now}
            tasks={tasks}
            slots={slots}
            sessions={sessions.data ?? []}
            subjects={subjects}
            dayStartHour={dayStartHour}
            nowMin={nowDayMin(now, dayStartHour)}
            isToday={isToday}
            onMove={actions.setBlock}
            onOpen={(task) => setDialog({ task })}
            onAddAt={(start) => openAdd({ start_min: start, end_min: Math.min(1440, start + 60) })}
          />
        ) : view === "slot" ? (
          <SlotView
            slots={slots}
            tasks={tasks}
            subjects={subjects}
            dayStartHour={dayStartHour}
            onToggle={actions.toggleDone}
            onOpen={(task) => setDialog({ task })}
            onAdd={(slot) => openAdd({ slot_id: slot.id, start_min: slot.start_min, end_min: slot.end_min })}
            onAssign={actions.assignSlot}
          />
        ) : tasks.length === 0 ? (
          <EmptyState message={isToday ? "오늘 할 일이 없어요" : "이날 할 일이 없어요"} />
        ) : (
          <div className="flex flex-col gap-1" data-testid="task-list">
            <SortableList items={tasks.filter((t) => !t.done_at)} onReorder={actions.reorderTasks}>
              {(task, handle) => (
                <TaskItem
                  task={task}
                  handle={handle}
                  subject={task.subject_id ? subjects.get(task.subject_id) : undefined}
                  recurrence={task.recurrence_id ? recurrenceMap.get(task.recurrence_id) : undefined}
                  onToggle={(v) => actions.toggleDone(task, v)}
                  onEdit={() => setDialog({ task })}
                  onDefer={() => actions.deferOne(task)}
                  onDelete={() => askDelete(task)}
                  onMustDo={() => actions.setMustDo(task)}
                  onSplit={() => setSplitting(task)}
                />
              )}
            </SortableList>
            {tasks
              .filter((t) => t.done_at)
              .map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  subject={task.subject_id ? subjects.get(task.subject_id) : undefined}
                  recurrence={task.recurrence_id ? recurrenceMap.get(task.recurrence_id) : undefined}
                  onToggle={(v) => actions.toggleDone(task, v)}
                  onEdit={() => setDialog({ task })}
                  onDefer={() => actions.deferOne(task)}
                  onDelete={() => askDelete(task)}
                  onMustDo={() => actions.setMustDo(task)}
                  onSplit={() => setSplitting(task)}
                />
              ))}
          </div>
        )}
      </CardErrorBoundary>

      {view === "list" && deferTargets.length ? (
        <Button variant="dashed" block onClick={() => actions.deferMany(deferTargets.map((t) => t.id))} aria-keyshortcuts="Shift+D">
          못 한 일 {deferTargets.length}개 내일로 넘기기
        </Button>
      ) : null}

      <TaskDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        task={dialog?.task}
        defaults={dialog?.defaults}
        onSubmit={(values) => {
          const task = dialog?.task;
          if (!task) void actions.add(values);
          else if (task.recurrence_id) setPending({ kind: "edit", task, values });
          else void actions.edit(task, values);
        }}
        onDelete={
          dialog?.task
            ? () => {
                const task = dialog.task as TaskRow;
                setDialog(null);
                askDelete(task);
              }
            : undefined
        }
      />
      <ScopeDialog
        open={pending !== null}
        action={pending?.kind ?? "edit"}
        onClose={() => setPending(null)}
        onChoose={(scope: Scope) => {
          if (pending?.kind === "edit") void actions.edit(pending.task, pending.values, scope);
          if (pending?.kind === "delete") void actions.remove(pending.task, scope);
          setPending(null);
        }}
      />
      <SplitDialog task={splitting} onClose={() => setSplitting(null)} onSplit={(titles) => splitting && actions.split(splitting, titles)} />
      <RoadmapPicker open={pickerOpen} onClose={() => setPickerOpen(false)} date={viewDate} />
      <RoadmapPusher open={pusherOpen} onClose={() => setPusherOpen(false)} date={viewDate} />
    </section>
  );
}
