"use client";

import { useState } from "react";
import Link from "next/link";
import { Maximize2, Pause, Play } from "lucide-react";
import { SubjectDot } from "@/components/ui/subject-dot";
import { cn } from "@/lib/cn";
import { useSubjects } from "@/lib/data/subjects";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { formatHM, formatHMS, formatHMSShort } from "@/lib/timer/format";
import { sessionSeconds } from "@/lib/timer/sessions";
import { SessionListDialog } from "./session-list-dialog";
import { useTimerContext } from "./timer-provider";

/**
 * 5.4 과목별 타이머 카드. --timer-bg 바탕.
 * horizontal: 과목 칩을 오른쪽에 (PC, 패드 세로) / 아니면 아래에
 */
export function TimerCard({ horizontal = false }: { horizontal?: boolean }) {
  const timer = useTimerContext();
  const { data: subjects } = useSubjects();
  const [showLog, setShowLog] = useState(false);
  const subjectList = subjects ?? [];
  const selected = subjectList.find((s) => s.id === timer.selectedSubject) ?? subjectList[0];
  const running = Boolean(timer.studying);
  const elapsed = timer.studying ? sessionSeconds(timer.studying, timer.now) : 0;

  return (
    <section aria-label="과목별 타이머" className="rounded-card bg-timer-bg px-4.5 py-5.5 pad:p-7">
      <div className={cn("flex gap-6", horizontal ? "flex-col pad:flex-row pad:items-start" : "flex-col")}>
        <div className={cn("flex min-w-0 flex-col gap-1", horizontal && "pad:w-1/2")}>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-12 text-sub">
              과목별 타이머
              {running ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="size-dot rounded-full bg-check" aria-hidden />
                  측정 중
                </>
              ) : timer.napping ? (
                <>
                  <span aria-hidden>·</span> 쪽잠 중
                </>
              ) : null}
            </p>
            <Link
              href="/focus/"
              aria-label="집중 모드"
              className="hit inline-flex size-7 items-center justify-center rounded-input text-sub hover:text-ink"
            >
              <Maximize2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
            </Link>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-14 text-ink-2">
                {selected ? <SubjectDot color={selected.color_key} /> : null}
                <span className="truncate">{selected?.name ?? "과목을 추가해 주세요"}</span>
              </p>
              <p
                className="num text-36 leading-none font-medium tracking-num pad:text-40 land:text-44 pc:text-44"
                aria-live="off"
                data-testid="timer-elapsed"
              >
                {formatHMS(elapsed)}
              </p>
              <button type="button" onClick={() => setShowLog(true)} className="mt-2 text-12 text-sub hover:text-ink">
                오늘 순공 <span className="num">{formatHMSShort(timer.totals.total)}</span>
                <span className="ml-2 text-accent">기록 보기</span>
              </button>
            </div>
            <button
              type="button"
              onClick={timer.toggle}
              disabled={!selected}
              aria-label={running ? "타이머 일시정지" : "타이머 시작"}
              aria-pressed={running}
              className="inline-flex size-play-phone shrink-0 items-center justify-center rounded-full bg-btn text-btn-ink disabled:opacity-50 pad:size-play"
            >
              {running ? (
                <Pause size={ICON_SIZE.play} strokeWidth={ICON_STROKE} fill="currentColor" aria-hidden />
              ) : (
                <Play size={ICON_SIZE.play} strokeWidth={ICON_STROKE} fill="currentColor" aria-hidden className="translate-x-px" />
              )}
            </button>
          </div>
        </div>

        <div
          role="group"
          aria-label="과목 고르기"
          className={cn("flex flex-wrap gap-2", horizontal && "pad:w-1/2 pad:content-start")}
        >
          {subjectList.map((s, i) => {
            const on = s.id === selected?.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                aria-keyshortcuts={i < 8 ? String(i + 1) : undefined}
                onClick={() => timer.selectSubject(s.id)}
                className={cn(
                  "inline-flex h-chip-phone items-center gap-2 rounded-full px-3.5 text-13 pad:h-chip",
                  on ? "bg-chip-on text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-chip-off text-ink-2",
                )}
              >
                <SubjectDot color={s.color_key} />
                {s.name}
                <span className="num text-11 text-sub">{formatHM(timer.totals.bySubject.get(s.id) ?? 0)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <SessionListDialog open={showLog} onClose={() => setShowLog(false)} kind="study" />
    </section>
  );
}
