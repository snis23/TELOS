"use client";

import { useState } from "react";
import Link from "next/link";
import { Maximize2, Pause, Play } from "lucide-react";
import { SubjectDot } from "@/components/ui/subject-dot";
import { useSubjects } from "@/lib/data/subjects";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { formatHM, formatHMS, formatHMSShort } from "@/lib/timer/format";
import { sessionSeconds } from "@/lib/timer/sessions";
import { SessionListDialog } from "./session-list-dialog";
import { SubjectChips } from "./subject-chips";
import { useTimerContext } from "./timer-provider";

/**
 * 5.4 과목별 타이머 (작게): 과목·시간·재생 버튼 한 줄, 아래에 모의고사 | 내신 과목 칩.
 * 오늘 화면에서 시험 일정 옆 칸을 차지한다.
 */
export function TimerCard() {
  const timer = useTimerContext();
  const { data: subjects } = useSubjects();
  const [showLog, setShowLog] = useState(false);
  const subjectList = subjects ?? [];
  const selected = subjectList.find((s) => s.id === timer.selectedSubject) ?? subjectList[0];
  const running = Boolean(timer.studying);
  const elapsed = timer.studying ? sessionSeconds(timer.studying, timer.now) : 0;

  return (
    <section aria-label="과목별 타이머" className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-13 font-semibold">
          과목별 타이머
          {running ? (
            <span className="flex items-center gap-1 text-12 font-normal text-sub">
              <span className="size-dot rounded-full bg-check" aria-hidden />
              측정 중
            </span>
          ) : null}
        </h2>
        <Link
          href="/focus/"
          aria-label="집중 모드"
          className="hit inline-flex size-7 items-center justify-center rounded-input text-sub hover:text-ink"
        >
          <Maximize2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-13 text-ink-2">
            {selected ? <SubjectDot color={selected.color_key} /> : null}
            <span className="truncate">{selected?.name ?? "과목을 추가해 주세요"}</span>
          </p>
          <p className="num text-28 leading-tight font-medium tracking-num" aria-live="off" data-testid="timer-elapsed">
            {formatHMS(elapsed)}
          </p>
          <button type="button" onClick={() => setShowLog(true)} className="text-12 text-sub hover:text-ink">
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
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-btn text-btn-ink disabled:opacity-50"
        >
          {running ? (
            <Pause size={ICON_SIZE.tab} strokeWidth={ICON_STROKE} fill="currentColor" aria-hidden />
          ) : (
            <Play size={ICON_SIZE.tab} strokeWidth={ICON_STROKE} fill="currentColor" aria-hidden className="translate-x-px" />
          )}
        </button>
      </div>

      <SubjectChips
        selectedId={selected?.id}
        onSelect={(s) => timer.selectSubject(s.id)}
        extra={(s) => <span className="num text-11 text-sub">{formatHM(timer.totals.bySubject.get(s.id) ?? 0)}</span>}
      />
      <SessionListDialog open={showLog} onClose={() => setShowLog(false)} kind="study" />
    </section>
  );
}
