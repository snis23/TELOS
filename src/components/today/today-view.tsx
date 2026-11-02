"use client";

import { DdayCards } from "@/components/dday/dday-cards";
import { TaskCard } from "@/components/tasks/task-card";
import { NapCard } from "@/components/timer/nap-card";
import { LongSessionDialog, TimerConflictDialog } from "@/components/timer/timer-dialogs";
import { TimerCard } from "@/components/timer/timer-card";
import { useTimerContext } from "@/components/timer/timer-provider";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { useLayout } from "@/lib/use-layout";
import { NowCard } from "./now-card";
import { ReflectionCard } from "./reflection-card";
import { TermBanner } from "./term-banner";
import { TodayHeader } from "./today-header";

/**
 * 오늘 화면 (5장). 모든 크기에서 같은 순서:
 * 머리말 → 지금 카드(시각·일정·할 일) → [시험 일정 | 과목별 타이머] → [할 일 | 쪽잠·하루 코멘트]
 * 패드 가로·PC 는 두 칸씩 나란히, 패드 세로는 일정·타이머만 나란히, 폰은 한 줄씩.
 */
export function TodayView() {
  const layout = useLayout();
  const { today } = useTimerContext();
  const safe = (node: React.ReactNode) => <CardErrorBoundary>{node}</CardErrorBoundary>;
  const phone = layout === "phone";
  const wide = layout === "land" || layout === "pc";

  return (
    <>
      <TodayHeader />
      <TermBanner today={today} />
      <div className="flex flex-col gap-4 pad:gap-5">
        {safe(<NowCard />)}
        <div className={phone ? "flex flex-col gap-4" : "grid grid-cols-2 items-start gap-5"}>
          {safe(<DdayCards today={today} />)}
          {safe(<TimerCard />)}
        </div>
        {phone ? safe(<NapCard variant="line" />) : null}
        <div className={wide ? "grid grid-cols-5 items-start gap-5" : "flex flex-col gap-4 pad:gap-5"}>
          <div className={wide ? "col-span-3" : undefined}>{safe(<TaskCard />)}</div>
          {phone ? (
            <ReflectionCard date={today} asButton />
          ) : (
            <div className={wide ? "col-span-2 flex flex-col gap-5" : "grid grid-cols-2 items-start gap-5"}>
              {safe(<NapCard />)}
              {safe(<ReflectionCard date={today} />)}
            </div>
          )}
        </div>
      </div>
      <TimerConflictDialog />
      <LongSessionDialog />
    </>
  );
}
