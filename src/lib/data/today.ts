"use client";

import { getStudyDate } from "@/lib/date/study-date";
import { useNow } from "@/lib/use-now";
import { useDayStartHour } from "./profile";

/** 오늘 공부 날짜 (하루 기준 시각 적용, 1분마다 다시 계산) */
export function useToday(): string {
  const now = useNow(60_000);
  const h = useDayStartHour();
  return getStudyDate(now, h);
}
