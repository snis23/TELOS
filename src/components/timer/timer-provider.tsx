"use client";

import { createContext, useContext } from "react";
import { useToday } from "@/lib/data/today";
import { useTimer, type TimerApi } from "@/lib/data/timer";
import { useNow } from "@/lib/use-now";

type TimerContextValue = TimerApi & { now: Date; today: string };

const TimerContext = createContext<TimerContextValue | null>(null);

/** 타이머 상태는 한 곳에서만 관리한다 (오늘 화면, 집중 모드, 단축키가 같이 쓴다) */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const today = useToday();
  const now = useNow(1000);
  const timer = useTimer(today, now);
  return <TimerContext.Provider value={{ ...timer, now, today }}>{children}</TimerContext.Provider>;
}

export function useTimerContext(): TimerContextValue {
  const value = useContext(TimerContext);
  if (!value) throw new Error("useTimerContext must be used inside <TimerProvider>");
  return value;
}
