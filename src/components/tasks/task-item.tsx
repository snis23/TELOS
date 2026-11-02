"use client";

import { useRef, useState } from "react";
import { Repeat } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreMenu } from "@/components/ui/menu";
import { SubjectTag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { RecurrenceRow, SubjectRow, TaskRow } from "@/lib/supabase/database.types";
import { deferLabel, deferLevel } from "@/lib/tasks/defer";
import { ruleLabel } from "@/lib/tasks/recurrence";
import { useCoarsePointer } from "@/lib/use-layout";

type Props = {
  task: TaskRow;
  subject?: SubjectRow;
  recurrence?: RecurrenceRow;
  handle?: React.ReactNode;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDefer: () => void;
  onDelete: () => void;
  onMustDo: () => void;
  onSplit: () => void;
};

const SWIPE_OPEN = -168;

/**
 * 5.6 할 일 항목: 체크박스 → 과목 태그 → 제목 → 반복 표시 → 예상 시간.
 * 5.7 미룬 횟수에 따라 점, 바탕, 버튼 3개.
 * 항목 메뉴: 터치 기기는 왼쪽으로 밀기, 마우스는 ⋯ 버튼.
 */
export function TaskItem({ task, subject, recurrence, handle, onToggle, onEdit, onDefer, onDelete, onMustDo, onSplit }: Props) {
  const coarse = useCoarsePointer();
  const done = Boolean(task.done_at);
  const level = done ? 0 : deferLevel(task);
  const label = done ? null : deferLabel(task);
  const canDefer = !done && task.source !== "recurrence" && task.source !== "range";
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; y: number; base: number; active: boolean } | null>(null);

  const menuItems = [
    ...(canDefer ? [{ label: "내일로 넘기기", onSelect: onDefer }] : []),
    { label: "수정", onSelect: onEdit },
    { label: "삭제", onSelect: onDelete, danger: true },
  ];

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    drag.current = { x: e.clientX, y: e.clientY, base: offset, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) > 10) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < 10) return;
      d.active = true;
    }
    setOffset(Math.min(0, Math.max(SWIPE_OPEN, d.base + dx)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    setOffset((o) => (o < SWIPE_OPEN / 2 ? SWIPE_OPEN : 0));
  };
  const close = (fn: () => void) => () => {
    setOffset(0);
    fn();
  };

  return (
    <div className="relative overflow-hidden rounded-input" data-testid="task-item" data-defer-level={level}>
      {coarse ? (
        <div className="absolute inset-y-0 right-0 flex items-stretch" aria-hidden={offset === 0}>
          {canDefer ? (
            <button type="button" tabIndex={offset ? 0 : -1} onClick={close(onDefer)} className="w-14 bg-surface-2 text-12 text-ink-2">
              내일로
            </button>
          ) : null}
          <button type="button" tabIndex={offset ? 0 : -1} onClick={close(onEdit)} className="w-14 bg-nav-on text-12 text-accent-strong">
            수정
          </button>
          <button type="button" tabIndex={offset ? 0 : -1} onClick={close(onDelete)} className="w-14 bg-urgent-bg text-12 text-urgent-ink">
            삭제
          </button>
        </div>
      ) : null}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        className={cn(
          "relative flex flex-col gap-1 rounded-input px-2 py-1.5 transition-transform touch:touch-pan-y",
          level === 2 && "bg-warn-bg",
          level === 3 && "bg-urgent-bg",
          level < 2 && "bg-surface",
        )}
      >
        <div className="flex min-h-9 items-center gap-2">
          {handle ? <span className="hidden pad:inline-flex">{handle}</span> : null}
          <Checkbox checked={done} onChange={onToggle} label={`${task.title} ${done ? "완료 취소" : "완료"}`} />
          {subject ? <SubjectTag name={subject.name} color={subject.color_key} /> : null}
          {level === 1 ? <span aria-hidden className="size-dot shrink-0 rounded-full bg-defer-dot" /> : null}
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              "min-w-0 flex-1 truncate text-left text-13 pad:text-14",
              done ? "text-sub line-through" : "text-ink-2",
            )}
          >
            {task.title}
          </button>
          {recurrence ? (
            <span className="hidden shrink-0 items-center gap-1 text-11 text-sub pad:flex">
              <Repeat size={ICON_SIZE.pin} strokeWidth={ICON_STROKE} aria-hidden />
              {ruleLabel(recurrence.rule)}
            </span>
          ) : null}
          {task.est_minutes ? <span className="num shrink-0 text-11 text-sub">{task.est_minutes}분</span> : null}
          <MoreMenu label={`${task.title} 메뉴`} items={menuItems} className={cn(coarse && "sr-only focus-within:not-sr-only")} />
        </div>
        {label ? (
          <p
            className={cn(
              "pl-9 text-11 pad:pl-16",
              level === 1 && "text-warn-ink",
              level === 2 && "font-semibold text-warn-ink",
              level === 3 && "font-semibold text-urgent-ink",
            )}
          >
            {label}
          </p>
        ) : null}
        {level === 3 ? (
          <div className="flex flex-wrap gap-1.5 pb-1 pl-9 pad:pl-16">
            {!task.must_do ? (
              <button type="button" onClick={onMustDo} className="hit h-7 rounded-full bg-surface px-3 text-12 font-medium text-urgent-ink">
                오늘 꼭 하기
              </button>
            ) : (
              <span className="inline-flex h-7 items-center rounded-full bg-surface px-3 text-12 text-urgent-ink">오늘 꼭 하기</span>
            )}
            <button type="button" onClick={onSplit} className="hit h-7 rounded-full bg-surface px-3 text-12 font-medium text-urgent-ink">
              쪼개기
            </button>
            <button type="button" onClick={onDelete} className="hit h-7 rounded-full bg-surface px-3 text-12 font-medium text-urgent-ink">
              삭제
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
