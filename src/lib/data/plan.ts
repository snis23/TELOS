"use client";

import { useTableMutations } from "./crud";
import { useAllRows } from "./queries";

export function useGoals() {
  return useAllRows("goals", { orderBy: "sort_order" });
}
export function useGoalMutations() {
  return useTableMutations("goals");
}

/** 목표에 연결된 할 일 (진행률 계산용) */
export function useGoalTasks() {
  return useAllRows("tasks", { orderBy: "study_date" });
}

export function useUnits() {
  return useAllRows("units", { orderBy: "sort_order" });
}
export function useUnitMutations() {
  return useTableMutations("units");
}

export function useReviewChecks() {
  return useAllRows("review_checks", { orderBy: "created_at" });
}
