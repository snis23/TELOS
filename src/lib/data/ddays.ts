"use client";

import { useMemo } from "react";
import { examProgress } from "@/lib/exam/range";
import type { DdayRow, ExamSubjectDateRow, RangeItemRow } from "@/lib/supabase/database.types";
import { useTableMutations } from "./crud";
import { allKey, useAllRows } from "./queries";

export const ddaysKey = allKey("ddays", "date");

export function useDdays() {
  return useAllRows("ddays", { orderBy: "date" });
}

export function useRangeItems() {
  return useAllRows("range_items", { orderBy: "sort_order" });
}

export function useExamSubjectDates() {
  return useAllRows("exam_subject_dates", { orderBy: "date" });
}

export function useDdayMutations() {
  return useTableMutations("ddays");
}

/** 시험별 범위 진행률 (0~1, 범위가 없으면 null) */
export function useExamProgressMap(): Map<string, number | null> {
  const { data: items } = useRangeItems();
  return useMemo(() => examProgressMap(items ?? []), [items]);
}

export function examProgressMap(items: readonly RangeItemRow[]): Map<string, number | null> {
  const byDday = new Map<string, RangeItemRow[]>();
  for (const it of items) byDday.set(it.dday_id, [...(byDday.get(it.dday_id) ?? []), it]);
  return new Map([...byDday.entries()].map(([id, list]) => [id, examProgress(list)]));
}

/** 과목별 시험 날짜 (없으면 시험 첫날) */
export function subjectExamDate(dday: Pick<DdayRow, "id" | "date">, subjectId: string, dates: readonly ExamSubjectDateRow[]): string {
  return dates.find((d) => d.dday_id === dday.id && d.subject_id === subjectId && !d.deleted_at)?.date ?? dday.date;
}
