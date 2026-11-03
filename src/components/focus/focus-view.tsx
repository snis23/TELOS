"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Pause, Play, Shuffle } from "lucide-react";
import { useTimerContext } from "@/components/timer/timer-provider";
import { NapMode } from "@/components/timer/nap-mode";
import { SubjectChips } from "@/components/timer/subject-chips";
import { LongSessionDialog, TimerConflictDialog } from "@/components/timer/timer-dialogs";
import { TimerShortcuts } from "@/components/timer/timer-shortcuts";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { SubjectDot } from "@/components/ui/subject-dot";
import { useToast } from "@/components/ui/toast";
import { useCurrentSlotLabel } from "@/components/today/today-header";
import { cn } from "@/lib/cn";
import { useSubjects } from "@/lib/data/subjects";
import { useTaskMutations, useTasks } from "@/lib/data/tasks";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { overlapSeconds } from "@/lib/stats/daily";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { sortTasks } from "@/lib/tasks/defer";
import { formatDurationKo, formatHMS, formatHMSShort } from "@/lib/timer/format";

const IDLE_MS = 5000;
const WAKE_NOTICE_KEY = "telos:wake-lock-notice";

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * 5.9 집중 모드: 늘 어두운 화면, 전체 화면, 화면 꺼짐 방지.
 * 과목 이름 → 큰 타이머 → 지금 할 일 → 버튼 4개(재생, 과목 바꾸기, 쪽잠, 나가기).
 * 쪽잠을 켜면 쪽잠 모드 화면(NapMode)이 위를 덮는다.
 * 5초 동안 손대지 않으면 버튼을 흐리게 숨기고, 누르면 다시 보인다.
 */
export function FocusView() {
  const router = useRouter();
  const toast = useToast();
  const timer = useTimerContext();
  const { data: subjects } = useSubjects();
  const { data: tasks } = useTasks(timer.today);
  const { update } = useTaskMutations();
  const slotLabel = useCurrentSlotLabel();
  const [enteredAt] = useState(() => new Date());
  const [idle, setIdle] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickingTask, setPickingTask] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subjectList = subjects ?? [];
  const subject = subjectList.find((s) => s.id === timer.selectedSubject) ?? subjectList[0];
  const running = Boolean(timer.studying);

  // 지금 할 일: 그 과목의 첫 번째 안 끝낸 할 일 (눌러서 바꾸기, 체크하면 다음 할 일로)
  const open = useMemo(() => sortTasks((tasks ?? []).filter((t) => !t.done_at)), [tasks]);
  const ofSubject = open.filter((t) => t.subject_id === subject?.id);
  const current = open.find((t) => t.id === taskId) ?? ofSubject[0] ?? null;

  // 화면 꺼짐 방지 + 전체 화면
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
    const request = async () => {
      try {
        if (nav.wakeLock) lock = await nav.wakeLock.request("screen");
        else throw new Error("unsupported");
      } catch {
        try {
          if (!window.localStorage.getItem(WAKE_NOTICE_KEY)) {
            window.localStorage.setItem(WAKE_NOTICE_KEY, "1");
            setNotice("기기의 자동 잠금을 잠시 꺼 두세요");
          }
        } catch {
          // 무시
        }
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisible);
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // 5초 동안 손대지 않으면 버튼을 숨긴다
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const exit = () => {
    const window_ = { start: enteredAt, end: new Date() };
    const studied = timer.sessions
      .filter((s) => s.kind === "study")
      .reduce((sum, s) => sum + overlapSeconds(s.started_at, s.ended_at, window_, window_.end), 0);
    const finished = (tasks ?? []).filter((t) => t.done_at && new Date(t.done_at) >= enteredAt).length;
    toast.show({ message: `이번 집중 ${formatDurationKo(studied)} · 끝낸 할 일 ${finished}개` });
    router.push("/");
  };

  useShortcut({ code: "Escape" }, exit, { allowInEditable: true });

  // 큰 시간: 고른 과목의 오늘 전체 시간 (이번 측정만이 아니라)
  const subjectToday = subject ? (timer.totals.bySubject.get(subject.id) ?? 0) : 0;

  const round = "inline-flex size-play-phone items-center justify-center rounded-full pad:size-play";

  return (
    <div
      data-theme="dark"
      data-testid="focus-mode"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-bg px-5 py-10 text-ink"
    >
      <TimerShortcuts inFocus />
      {slotLabel ? <p className="absolute top-6 text-12 text-sub">{slotLabel}</p> : null}
      <p className="flex items-center gap-2 text-14 text-sub">
        {subject ? <SubjectDot color={subject.color_key} /> : null}
        {subject?.name ?? "과목 없음"}
      </p>
      <p className="num text-72 leading-none font-medium tracking-num pad:text-120" data-testid="focus-timer">
        {formatHMS(subjectToday)}
      </p>
      <p className="text-12 text-sub">
        오늘 순공(전체 과목) <span className="num">{formatHMSShort(timer.totals.total)}</span>
      </p>

      {current ? (
          <div className="flex max-w-dialog items-center gap-3 rounded-full bg-surface px-4 py-2">
            <Checkbox
              checked={false}
              label={`${current.title} 완료`}
              onChange={() => {
                update.mutate({ ids: [current.id], patch: { done_at: new Date().toISOString() } });
                setTaskId(null);
              }}
            />
            <button type="button" onClick={() => setPickingTask(true)} className="min-w-0 truncate text-14 text-ink-2">
              {current.title}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setPickingTask(true)} className="text-13 text-sub">
            {open.length ? "지금 할 일 고르기" : "남은 할 일이 없어요"}
          </button>
        )}

      <div
        className={cn(
          "mt-4 flex items-center gap-4 transition-opacity",
          idle ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden={idle}
      >
        <button type="button" onClick={timer.toggle} aria-label={running ? "타이머 일시정지" : "타이머 시작"} className={cn(round, "bg-btn text-btn-ink")}>
          {running ? (
            <Pause size={ICON_SIZE.play} strokeWidth={ICON_STROKE} fill="currentColor" />
          ) : (
            <Play size={ICON_SIZE.play} strokeWidth={ICON_STROKE} fill="currentColor" className="translate-x-px" />
          )}
        </button>
        <button type="button" onClick={() => setPicking(true)} aria-label="과목 바꾸기" className={cn(round, "bg-surface-2 text-ink")}>
          <Shuffle size={ICON_SIZE.tab} strokeWidth={ICON_STROKE} />
        </button>
        <button type="button" onClick={timer.toggleNap} aria-label="쪽잠" className={cn(round, "bg-nap-soft text-nap-ink")}>
          <Moon size={ICON_SIZE.tab} strokeWidth={ICON_STROKE} />
        </button>
        <button type="button" onClick={exit} aria-label="나가기" className={cn(round, "bg-surface-2 text-ink")}>
          <LogOut size={ICON_SIZE.tab} strokeWidth={ICON_STROKE} />
        </button>
      </div>

      {notice ? (
        <p role="status" className="absolute bottom-8 text-12 text-sub">
          {notice}
        </p>
      ) : null}

      <Dialog open={picking} onClose={() => setPicking(false)} title="과목 바꾸기">
        <SubjectChips
          className="pb-2"
          selectedId={subject?.id}
          onSelect={(s) => {
            timer.selectSubject(s.id);
            setTaskId(null);
            setPicking(false);
          }}
        />
      </Dialog>
      <Dialog open={pickingTask} onClose={() => setPickingTask(false)} title="지금 할 일">
        <ul className="flex flex-col gap-1">
          {open.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setTaskId(t.id);
                  setPickingTask(false);
                }}
                className="flex h-11 w-full items-center rounded-input px-3 text-left text-14 text-ink-2 hover:bg-surface-2"
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
      <TimerConflictDialog />
      <LongSessionDialog />
      <NapMode />
    </div>
  );
}
