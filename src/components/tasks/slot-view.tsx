"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SubjectTag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { SubjectRow, TaskRow, TimetableSlotRow } from "@/lib/supabase/database.types";
import { formatDayMin } from "@/lib/timetable/time";

/**
 * 5.11 시간표 보기 (교시·차시): 그날 시간표 항목을 시간 순서대로 한 줄씩.
 * 줄마다 배정된 할 일과 [+ 할 일]. 수업 교시는 접어 두고 자습·야자 차시는 펼쳐 둔다.
 */
export function SlotView({
  slots,
  tasks,
  subjects,
  dayStartHour,
  onToggle,
  onOpen,
  onAdd,
  onAssign,
}: {
  slots: readonly TimetableSlotRow[];
  tasks: readonly TaskRow[];
  subjects: ReadonlyMap<string, SubjectRow>;
  dayStartHour: number;
  onToggle: (task: TaskRow, done: boolean) => void;
  onOpen: (task: TaskRow) => void;
  onAdd: (slot: TimetableSlotRow) => void;
  onAssign: (task: TaskRow, slotId: string | null) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (s: TimetableSlotRow) => open[s.id] ?? s.category === "study";
  const unassigned = tasks.filter((t) => !t.slot_id || !slots.some((s) => s.id === t.slot_id));

  if (slots.length === 0) {
    return <p className="text-13 text-sub">이날 시간표가 없어요. 설정 &gt; 학교 시간표에서 만들 수 있어요</p>;
  }

  return (
    <div className="flex flex-col" data-testid="slot-view">
      {slots.map((slot) => {
        const assigned = tasks.filter((t) => t.slot_id === slot.id);
        const expanded = isOpen(slot);
        return (
          <div key={slot.id} className="border-b border-line py-1.5 last:border-b-0">
            <div className="flex min-h-9 items-center gap-2">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen({ ...open, [slot.id]: !expanded })}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-input px-2 py-1 text-left text-13",
                  slot.category === "study" && "bg-nav-on text-accent-strong",
                  slot.category === "class" && "bg-surface-2 text-ink-2",
                  (slot.category === "meal" || slot.category === "life") && "text-sub",
                )}
              >
                <ChevronDown
                  size={ICON_SIZE.inline}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                  className={cn("shrink-0 transition-transform", !expanded && "-rotate-90")}
                />
                <span className="truncate font-medium">{slot.name}</span>
                <span className="num text-12">
                  {formatDayMin(slot.start_min, dayStartHour)}–{formatDayMin(slot.end_min, dayStartHour)}
                </span>
                {assigned.length ? <span className="num ml-auto text-11">{assigned.length}</span> : null}
              </button>
              <button
                type="button"
                onClick={() => onAdd(slot)}
                aria-label={`${slot.name}에 할 일 추가`}
                className="hit inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-12 text-accent"
              >
                <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />할 일
              </button>
            </div>
            {expanded && assigned.length ? (
              <ul className="mt-1 flex flex-col pl-6">
                {assigned.map((t) => (
                  <SlotTask key={t.id} task={t} subject={t.subject_id ? subjects.get(t.subject_id) : undefined} onToggle={onToggle} onOpen={onOpen} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}

      {unassigned.length ? (
        <div className="mt-4">
          <p className="mb-1 text-12 text-sub">차시가 없는 할 일</p>
          <ul className="flex flex-col">
            {unassigned.map((t) => (
              <SlotTask
                key={t.id}
                task={t}
                subject={t.subject_id ? subjects.get(t.subject_id) : undefined}
                onToggle={onToggle}
                onOpen={onOpen}
                assign={
                  <select
                    aria-label={`${t.title} 차시에 넣기`}
                    value=""
                    onChange={(e) => onAssign(t, e.target.value || null)}
                    className="h-7 max-w-28 shrink-0 rounded-input bg-surface-2 px-2 text-12 text-ink-2"
                  >
                    <option value="">차시에 넣기</option>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                }
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SlotTask({
  task,
  subject,
  onToggle,
  onOpen,
  assign,
}: {
  task: TaskRow;
  subject?: SubjectRow;
  onToggle: (task: TaskRow, done: boolean) => void;
  onOpen: (task: TaskRow) => void;
  assign?: React.ReactNode;
}) {
  const done = Boolean(task.done_at);
  return (
    <li className="flex min-h-9 items-center gap-2">
      <Checkbox checked={done} onChange={(v) => onToggle(task, v)} label={`${task.title} 완료`} />
      {subject ? <SubjectTag name={subject.name} color={subject.color_key} /> : null}
      <button
        type="button"
        onClick={() => onOpen(task)}
        className={cn("min-w-0 flex-1 truncate text-left text-13", done ? "text-sub line-through" : "text-ink-2")}
      >
        {task.title}
      </button>
      {assign}
    </li>
  );
}
