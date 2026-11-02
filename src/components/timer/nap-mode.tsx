"use client";

import { useEffect, useRef } from "react";
import { Moon } from "lucide-react";
import { formatClock } from "@/lib/date/days";
import { ICON_STROKE } from "@/lib/design/icons";
import { formatHMS } from "@/lib/timer/format";
import { sessionSeconds } from "@/lib/timer/sessions";
import { useTimerContext } from "./timer-provider";

/**
 * 5.5 쪽잠 모드: 쪽잠을 켜면 어두운 전체 화면으로 덮고, 지금 시각·쪽잠 시간·[쪽잠 끝]만 보여 준다.
 * 브라우저 기본 모달(<dialog>)이라 뒤의 화면은 누르거나 키보드로 갈 수 없다. Esc 로 닫히지 않는다.
 * 다른 기기에서 쪽잠을 켜도 실시간 동기화로 같은 화면이 뜬다. N 키로도 끝낸다.
 */
export function NapMode() {
  const { napping, now, endNap } = useTimerContext();
  if (!napping) return null;
  return <NapScreen seconds={sessionSeconds(napping, now)} now={now} onEnd={endNap} />;
}

function NapScreen({ seconds, now, onEnd }: { seconds: number; now: Date; onEnd: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label="쪽잠 중"
      data-theme="dark"
      data-testid="nap-mode"
      className="nap-mode m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-bg p-0 text-ink"
      onCancel={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.code === "KeyN" && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) onEnd();
      }}
    >
      <div className="flex h-full flex-col items-center justify-center gap-6 px-5">
        <p className="num text-36 font-medium text-ink-2" aria-label="지금 시각">
          {formatClock(now)}
        </p>
        <p className="flex items-center gap-2 text-14 text-nap-ink">
          <Moon size={16} strokeWidth={ICON_STROKE} aria-hidden />
          쪽잠 중 · 공부 타이머 멈춤
        </p>
        <p className="num text-72 leading-none font-medium tracking-num text-nap-ink pad:text-120" data-testid="nap-elapsed">
          {formatHMS(seconds)}
        </p>
        <button
          type="button"
          autoFocus
          onClick={onEnd}
          className="mt-4 inline-flex h-14 items-center gap-2 rounded-full bg-nap-on px-8 text-15 font-semibold text-ink"
        >
          <Moon size={18} strokeWidth={ICON_STROKE} aria-hidden />
          쪽잠 끝
        </button>
      </div>
    </dialog>
  );
}
