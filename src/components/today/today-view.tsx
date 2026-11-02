"use client";

import { DdayCards } from "@/components/dday/dday-cards";
import { TaskCard } from "@/components/tasks/task-card";
import { NapCard } from "@/components/timer/nap-card";
import { LongSessionDialog, TimerConflictDialog } from "@/components/timer/timer-dialogs";
import { TimerCard } from "@/components/timer/timer-card";
import { useTimerContext } from "@/components/timer/timer-provider";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { useLayout } from "@/lib/use-layout";
import { ReflectionCard } from "./reflection-card";
import { TodayHeader } from "./today-header";

/**
 * 오늘 화면 (5장, 4장 표):
 * 폰: 제목 → D-day → 타이머 → 쪽잠 한 줄 → 할 일 → 회고 버튼
 * 패드 세로: 1열(최대 720px): 제목 → D-day 한 줄 → 타이머(가로) → 할 일 → 쪽잠·회고 2열
 * 패드 가로: 2열(왼쪽 380px): 왼쪽 D-day 2×2 → 타이머 → 쪽잠 / 오른쪽 할 일 → 회고
 * PC: 제목 → D-day 한 줄 → 타이머(가로, 전체 너비) → 2열(할 일 3 : 쪽잠·회고 2)
 */
export function TodayView() {
  const layout = useLayout();
  const { today } = useTimerContext();
  const safe = (node: React.ReactNode) => <CardErrorBoundary>{node}</CardErrorBoundary>;

  let body: React.ReactNode;
  if (layout === "phone") {
    body = (
      <div className="card-stack">
        {safe(<DdayCards today={today} layout="stack" />)}
        {safe(<TimerCard />)}
        {safe(<NapCard variant="line" />)}
        {safe(<TaskCard />)}
        <ReflectionCard date={today} asButton />
      </div>
    );
  } else if (layout === "pad") {
    body = (
      <div className="card-stack mx-auto max-w-portrait">
        {safe(<DdayCards today={today} layout="row" />)}
        {safe(<TimerCard horizontal />)}
        {safe(<TaskCard />)}
        <div className="grid grid-cols-2 gap-8">
          {safe(<NapCard />)}
          {safe(<ReflectionCard date={today} />)}
        </div>
      </div>
    );
  } else if (layout === "land") {
    body = (
      <div className="grid grid-cols-[var(--spacing-left-col)_minmax(0,1fr)] items-start gap-8">
        <div className="card-stack">
          {safe(<DdayCards today={today} layout="grid" />)}
          {safe(<TimerCard />)}
          {safe(<NapCard />)}
        </div>
        <div className="card-stack">
          {safe(<TaskCard />)}
          {safe(<ReflectionCard date={today} />)}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="card-stack">
        {safe(<DdayCards today={today} layout="row" />)}
        {safe(<TimerCard horizontal />)}
        <div className="grid grid-cols-5 items-start gap-8">
          <div className="col-span-3">{safe(<TaskCard />)}</div>
          <div className="col-span-2 card-stack">
            {safe(<NapCard />)}
            {safe(<ReflectionCard date={today} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <TodayHeader />
      {body}
      <TimerConflictDialog />
      <LongSessionDialog />
    </>
  );
}
