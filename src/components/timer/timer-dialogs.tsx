"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { TimeSelect } from "@/components/ui/time-select";
import { useDayStartHour } from "@/lib/data/profile";
import { useSubjectMap } from "@/lib/data/subjects";
import { formatClock } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import { isLongRunning } from "@/lib/timer/sessions";
import { useTimerContext } from "./timer-provider";

/** "다른 기기에서 수학 측정 중이에요. 여기서 이어서 할까요?" (5.4) */
export function TimerConflictDialog() {
  const { conflict, resolveConflict, dismissConflict } = useTimerContext();
  const subjects = useSubjectMap();
  if (!conflict) return null;
  const what =
    conflict.active.kind === "nap" ? "쪽잠" : (subjects.get(conflict.active.subject_id ?? "")?.name ?? "공부");
  return (
    <ConfirmDialog
      open
      title="다른 기기에서 측정 중이에요"
      message={`다른 기기에서 ${what} 측정 중이에요. 여기서 이어서 할까요?`}
      confirmLabel="이어서 하기"
      onConfirm={resolveConflict}
      onClose={dismissConflict}
    />
  );
}

const ASKED_KEY = "telos:long-session-ok";

/** "3시간 넘게 측정 중이에요. 아직 공부 중인가요?" [계속] [끝난 시각 입력] */
export function LongSessionDialog() {
  const { active, now, endAt } = useTimerContext();
  const dayStartHour = useDayStartHour();
  const [mode, setMode] = useState<"ask" | "time">("ask");
  const [okIds, setOkIds] = useState<string[]>(() => {
    try {
      return JSON.parse(window.sessionStorage.getItem(ASKED_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [clock, setClock] = useState<number | null>(null);

  if (!active || !isLongRunning(active, now) || okIds.includes(active.id)) return null;

  const keep = () => {
    const next = [...okIds, active.id];
    setOkIds(next);
    try {
      window.sessionStorage.setItem(ASKED_KEY, JSON.stringify(next));
    } catch {
      // 무시
    }
  };

  const started = new Date(active.started_at);
  const startDate = getStudyDate(started, dayStartHour);
  const [sh, sm] = formatClock(started).split(":").map(Number);
  const startClock = sh * 60 + sm;
  const value = clock ?? Math.min(startClock + 60, 23 * 60 + 50);

  const submit = () => {
    // 시작한 공부 날짜 기준으로 시각을 만든다 (기준 시각보다 이르면 다음 날 새벽)
    const h = Math.floor(value / 60);
    const m = value % 60;
    const at = new Date(`${startDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`);
    if (h < dayStartHour) at.setUTCDate(at.getUTCDate() + 1);
    if (at <= started || at > now) return;
    endAt(active.id, at);
    keep();
  };

  return (
    <Dialog
      open
      onClose={keep}
      title="3시간 넘게 측정 중이에요"
      footer={
        mode === "ask" ? (
          <>
            <Button variant="secondary" onClick={() => setMode("time")}>
              끝난 시각 입력
            </Button>
            <Button onClick={keep}>계속</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setMode("ask")}>
              뒤로
            </Button>
            <Button onClick={submit}>저장</Button>
          </>
        )
      }
    >
      {mode === "ask" ? (
        <p className="text-13 text-ink-2">아직 공부 중인가요? {formatClock(started)}에 시작했어요.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <TimeSelect label="끝난 시각" value={value} onChange={setClock} firstHour={dayStartHour} />
          <p className="text-12 text-sub">시작 {formatClock(started)} 이후, 지금보다 이른 시각으로 골라 주세요</p>
        </div>
      )}
    </Dialog>
  );
}
