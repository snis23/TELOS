"use client";

import { useDdays } from "@/lib/data/ddays";
import { useToday } from "@/lib/data/today";
import { hasUrgent } from "@/lib/dday/dday";

/** 시험 메뉴의 작은 점: 7일 이내 D-day 가 있으면 (4.1) */
export function useHasUrgentExam(): boolean {
  const today = useToday();
  const { data } = useDdays();
  return hasUrgent(data ?? [], today);
}
