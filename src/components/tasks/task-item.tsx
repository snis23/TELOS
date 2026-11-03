"use client";

import { Repeat } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreMenu } from "@/components/ui/menu";
import { SubjectTag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { RecurrenceRow, SubjectRow, TaskRow } from "@/lib/supabase/database.types";
import { deferLabel, deferLevel } from "@/lib/tasks/defer";
import { ruleLabel } from "@/lib/tasks/recurrence";

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

/**
 * 5.6 할 일 항목: 체크박스 → 과목 태그 → 제목 → 반복 표시 → 예상 시간 → ⋯ 메뉴.
 * 5.7 미룬 횟수에 따라 점, 바탕, 버튼 3개.
 * 제목을 누르거나 ⋯ 메뉴의 "제목·과목 수정"으로 수정 창을 연다 (모든 기기에서 ⋯ 가 보인다).
 */
export function TaskItem({ task, subject, recurrence, handle, onToggle, onEdit, onDefer, onDelete, onMustDo, onSplit }: Props) {
  const done = Boolean(task.done_at);
  const level = done ? 0 : deferLevel(task);
  const label = done ? null : deferLabel(task);
  const canDefer = !done && task.source !== "recurrence";

  const menuItems = [
    { label: "제목·과목 수정", onSelect: onEdit },
    ...(canDefer ? [{ label: "내일로 넘기기", onSelect: onDefer }] : []),
    { label: "삭제", onSelect: onDelete, danger: true },
  ];

  return (
    <div className="rounded-input" data-testid="task-item" data-defer-level={level}>
      <div
        className={cn(
          "relative flex flex-col gap-1 rounded-input px-2 py-1.5",
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
          <MoreMenu label={`${task.title} 메뉴`} items={menuItems} />
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
