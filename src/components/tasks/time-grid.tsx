"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { SubjectRow, TaskRow, TimerSessionRow, TimetableSlotRow } from "@/lib/supabase/database.types";
import { assignLanes, moveBlock, resizeBlock, segmentsOf, studyBars } from "@/lib/timetable/grid";
import { studyDayWindow } from "@/lib/stats/daily";
import { formatDayMin } from "@/lib/timetable/time";

const ROWS = 24;
const ROW_H = 44;
const LONG_PRESS_MS = 300;

type Drag = {
  id: string;
  mode: "move" | "resize";
  grab: number;
  start: number;
  end: number;
  pointerId: number;
  armed: boolean;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout> | null;
};

/**
 * 5.11 시간 보기 (10분 단위). 1시간이 한 줄, 하루 기준 시각부터 24줄, 줄마다 10분 칸 6개.
 * 학교 시간표는 흐린 바탕으로 깔고, 할 일은 과목 태그 색 블록으로 위에 그린다.
 * 끌어서 옮기기, 끝을 끌어 길이 바꾸기, 빈 칸을 눌러 추가 (터치 기기는 길게 누른 뒤 끈다).
 */
export function TimeGrid({
  date,
  now,
  tasks,
  slots,
  sessions,
  subjects,
  dayStartHour,
  nowMin,
  isToday,
  onMove,
  onOpen,
  onAddAt,
}: {
  date: string;
  now: Date;
  tasks: readonly TaskRow[];
  slots: readonly TimetableSlotRow[];
  sessions: readonly TimerSessionRow[];
  subjects: ReadonlyMap<string, SubjectRow>;
  dayStartHour: number;
  nowMin: number | null;
  isToday: boolean;
  onMove: (task: TaskRow, start: number, end: number) => void;
  onOpen: (task: TaskRow) => void;
  onAddAt: (start: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const blocks = useMemo(
    () =>
      tasks
        .filter((t) => t.start_min !== null && t.end_min !== null)
        .map((t) => {
          const d = drag && drag.id === t.id && drag.armed ? drag : null;
          return { task: t, id: t.id, start: d ? d.start : (t.start_min as number), end: d ? d.end : (t.end_min as number) };
        }),
    [tasks, drag],
  );
  const lanes = useMemo(() => assignLanes(blocks), [blocks]);

  // 타이머로 실제 공부한 시간: 줄 아래 3px 막대
  const bars = useMemo(() => {
    const w = studyDayWindow(date, dayStartHour).start.getTime();
    const toMin = (iso: string) => Math.min(1440, Math.max(0, (new Date(iso).getTime() - w) / 60_000));
    const intervals = sessions
      .filter((s) => s.kind === "study")
      .map((s) => ({
        start: toMin(s.started_at),
        end: s.ended_at ? toMin(s.ended_at) : Math.min(1440, Math.max(0, (now.getTime() - w) / 60_000)),
        subjectId: s.subject_id,
      }))
      .filter((iv) => iv.end > iv.start);
    return studyBars(intervals);
  }, [sessions, dayStartHour, date, now]);

  // 처음 열 때 지금 시각 위치로 스크롤
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const row = isToday && nowMin !== null ? Math.floor(nowMin / 60) : 0;
    el.scrollTop = Math.max(0, (row - 1) * ROW_H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);

  const pointerMin = (clientX: number, clientY: number): number => {
    const rect = area.current?.getBoundingClientRect();
    if (!rect) return 0;
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor((clientY - rect.top) / ROW_H)));
    const x = Math.min(rect.width - 1, Math.max(0, clientX - rect.left));
    return row * 60 + (x / rect.width) * 60;
  };

  // 터치로 끌 때는 화면이 스크롤되지 않게 막는다
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.armed) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const update = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  // 끌기 중에는 블록이 다른 줄로 넘어가며 다시 그려지므로, 움직임과 놓기는 창 전체에서 받는다
  const latest = useRef({ tasks, onMove, onOpen });
  useEffect(() => {
    latest.current = { tasks, onMove, onOpen };
  });

  const onBlockDown = (e: React.PointerEvent, task: TaskRow, mode: Drag["mode"]) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const start = task.start_min as number;
    const end = task.end_min as number;
    const min = pointerMin(e.clientX, e.clientY);
    const touch = e.pointerType === "touch";
    const d: Drag = {
      id: task.id,
      mode,
      grab: min - start,
      start,
      end,
      pointerId: e.pointerId,
      armed: !touch,
      x: e.clientX,
      y: e.clientY,
      timer: null,
    };
    if (touch) {
      d.timer = setTimeout(() => {
        if (dragRef.current?.id === task.id) update({ ...dragRef.current, armed: true });
      }, LONG_PRESS_MS);
    }
    update(d);

    const onMoveWin = (ev: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur || ev.pointerId !== cur.pointerId) return;
      if (!cur.armed) {
        if (Math.hypot(ev.clientX - cur.x, ev.clientY - cur.y) > 8) finish(ev, false);
        return;
      }
      const t = latest.current.tasks.find((x) => x.id === cur.id);
      if (!t) return;
      const base = { id: t.id, start: t.start_min as number, end: t.end_min as number };
      const pm = pointerMin(ev.clientX, ev.clientY);
      const next = cur.mode === "move" ? moveBlock(base, pm, cur.grab) : resizeBlock(base, pm);
      if (next.start !== cur.start || next.end !== cur.end) update({ ...cur, ...next });
    };
    const finish = (ev: PointerEvent, commit: boolean) => {
      window.removeEventListener("pointermove", onMoveWin);
      window.removeEventListener("pointerup", onUpWin);
      window.removeEventListener("pointercancel", onCancelWin);
      const cur = dragRef.current;
      if (!cur) return;
      if (cur.timer) clearTimeout(cur.timer);
      update(null);
      if (!commit) return;
      const t = latest.current.tasks.find((x) => x.id === cur.id);
      if (!t) return;
      const moved = cur.start !== t.start_min || cur.end !== t.end_min;
      if (cur.armed && moved) latest.current.onMove(t, cur.start, cur.end);
      else if (Math.hypot(ev.clientX - cur.x, ev.clientY - cur.y) < 8) latest.current.onOpen(t);
    };
    const onUpWin = (ev: PointerEvent) => {
      if (ev.pointerId === dragRef.current?.pointerId) finish(ev, true);
    };
    const onCancelWin = (ev: PointerEvent) => {
      if (ev.pointerId === dragRef.current?.pointerId) finish(ev, false);
    };
    window.addEventListener("pointermove", onMoveWin);
    window.addEventListener("pointerup", onUpWin);
    window.addEventListener("pointercancel", onCancelWin);
  };

  const onAreaUp = (e: React.PointerEvent) => {
    if (dragRef.current) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const min = Math.floor(pointerMin(e.clientX, e.clientY) / 10) * 10;
    onAddAt(Math.min(min, 1430));
  };

  return (
    <div ref={scroller} className="max-h-[70vh] overflow-y-auto overscroll-contain" data-testid="time-grid">
      <div className="flex">
        <div aria-hidden className="w-9 shrink-0">
          {Array.from({ length: ROWS }, (_, r) => (
            <div key={r} className="num flex h-11 items-start text-14 leading-none text-sub">
              {formatDayMin(r * 60, dayStartHour).slice(0, 2)}
            </div>
          ))}
        </div>
        <div
          ref={area}
          role="grid"
          aria-label="10분 단위 하루 시간표. 빈 칸을 누르면 그 시각에 할 일을 추가해요"
          className="relative min-w-0 flex-1 cursor-cell select-none"
          onPointerUp={onAreaUp}
        >
          {Array.from({ length: ROWS }, (_, r) => (
            <div key={r} role="row" className="relative flex h-11 border-t border-line">
              {Array.from({ length: 6 }, (_, c) => (
                <div key={c} className={cn("h-full flex-1", c > 0 && "border-l border-dashed border-line")} />
              ))}
            </div>
          ))}

          {/* 학교 시간표 (흐린 바탕) */}
          {slots.flatMap((s) =>
            segmentsOf({ id: s.id, start: s.start_min, end: s.end_min }).map((seg) => (
              <div
                key={`${s.id}-${seg.row}`}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute flex items-start overflow-hidden px-1 pt-0.5 text-11",
                  s.category === "study" && "bg-nav-on text-accent-strong",
                  s.category === "class" && "bg-surface-2 text-ink-2",
                  (s.category === "meal" || s.category === "life") && "text-sub",
                )}
                style={{ top: seg.row * ROW_H + 1, height: ROW_H - 1, left: pct(seg.from), width: pct(seg.to - seg.from) }}
              >
                {seg.first ? <span className="truncate">{s.name}</span> : null}
              </div>
            )),
          )}

          {/* 실제 공부한 시간 막대 */}
          {bars.map((b, i) => {
            const subject = b.subjectId ? subjects.get(b.subjectId) : undefined;
            return (
              <div
                key={i}
                aria-hidden
                data-subject={subject?.color_key}
                className="pointer-events-none absolute h-bar rounded-full bg-s-dot"
                style={{ top: (b.row + 1) * ROW_H - 3, left: pct(b.from), width: pct(b.to - b.from) }}
              />
            );
          })}

          {/* 할 일 블록 */}
          {blocks.flatMap((b) => {
            const lane = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
            const subject = b.task.subject_id ? subjects.get(b.task.subject_id) : undefined;
            const h = (ROW_H - 6) / lane.lanes;
            const dragging = drag?.id === b.id && drag.armed;
            return segmentsOf(b).map((seg) => (
              <div
                key={`${b.id}-${seg.row}`}
                data-block
                data-subject={subject?.color_key ?? "periwinkle"}
                className={cn(
                  "absolute flex touch-pan-y items-center overflow-hidden bg-s-tag text-11 text-s-tag-ink",
                  seg.first && "rounded-l-key",
                  seg.last && "rounded-r-key",
                  b.task.done_at && "line-through opacity-60",
                  dragging && "outline-2 outline-check",
                )}
                style={{
                  top: seg.row * ROW_H + 2 + lane.lane * h,
                  height: h - 1,
                  left: pct(seg.from),
                  width: pct(seg.to - seg.from),
                }}
              >
                <button
                  type="button"
                  aria-label={`${b.task.title} ${formatDayMin(b.start, dayStartHour)}–${formatDayMin(b.end, dayStartHour)}`}
                  className="h-full min-w-0 flex-1 cursor-grab truncate px-1 text-left"
                  onPointerDown={(e) => onBlockDown(e, b.task, "move")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(b.task);
                  }}
                  tabIndex={seg.first ? 0 : -1}
                  aria-hidden={seg.first ? undefined : true}
                >
                  {seg.first ? b.task.title : ""}
                </button>
                {seg.last ? (
                  <span
                    aria-hidden
                    className="h-full w-2 shrink-0 cursor-ew-resize"
                    onPointerDown={(e) => onBlockDown(e, b.task, "resize")}
                  />
                ) : null}
              </div>
            ));
          })}

          {/* 지금 시각: --check 가로선 */}
          {isToday && nowMin !== null ? (
            <div
              aria-label={`지금 ${formatDayMin(nowMin, dayStartHour)}`}
              className="pointer-events-none absolute left-0 h-0.5 rounded-full bg-check"
              style={{ top: Math.floor(nowMin / 60) * ROW_H, width: pct(nowMin % 60) }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function pct(min: number): string {
  return `${(min / 60) * 100}%`;
}
