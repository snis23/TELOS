"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { examProgressMap } from "@/lib/exam/roadmap";
import { requireSupabase } from "@/lib/supabase/client";
import type { RoadmapItemRow } from "@/lib/supabase/database.types";
import { useTableMutations } from "./crud";
import { allKey, useAllRows } from "./queries";
import { useSaveErrorToast } from "./save-error";

export const ddaysKey = allKey("ddays", "date");
export const examSubjectsKey = allKey("exam_subjects", "sort_order");
export const roadmapKey = allKey("roadmap_items", "study_date");

export function useDdays() {
  return useAllRows("ddays", { orderBy: "date" });
}

export function useDdayMutations() {
  return useTableMutations("ddays");
}

/** 시험에 들어가는 과목 (시험 날짜·범위 메모) */
export function useExamSubjects() {
  return useAllRows("exam_subjects", { orderBy: "sort_order" });
}

export function useExamSubjectMutations() {
  return useTableMutations("exam_subjects", { unique: "이미 넣은 과목이에요" });
}

/** 모든 시험의 로드맵 칸 */
export function useRoadmapItems() {
  return useAllRows("roadmap_items", { orderBy: "study_date" });
}

/** 시험별 진행률 (0~1, 로드맵 칸이 없으면 null) */
export function useExamProgressMap(): Map<string, number | null> {
  const { data: items } = useRoadmapItems();
  return useMemo(() => examProgressMap(items ?? []), [items]);
}

/** 로드맵 칸 저장 + 체크할 때 그 칸으로 만든 할 일도 같이 체크 */
export function useRoadmapActions() {
  const items = useTableMutations("roadmap_items");
  const tasks = useTableMutations("tasks");
  const queryClient = useQueryClient();
  const onSaveError = useSaveErrorToast();

  const toggle = (item: Pick<RoadmapItemRow, "id">, done: boolean) => {
    const doneAt = done ? new Date().toISOString() : null;
    items.update.mutate({ ids: [item.id], patch: { done_at: doneAt } });
    void (async () => {
      const { data, error } = await requireSupabase()
        .from("tasks")
        .select("id")
        .eq("roadmap_item_id", item.id)
        .is("deleted_at", null);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.id);
      if (ids.length) tasks.update.mutate({ ids, patch: { done_at: doneAt } });
    })().catch((error) => {
      onSaveError(error);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });
  };

  return { ...items, toggle };
}
