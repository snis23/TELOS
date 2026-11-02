"use client";

import { useQuery } from "@tanstack/react-query";
import { pickableSubjects } from "@/lib/subjects/subjects";
import { requireSupabase } from "@/lib/supabase/client";
import type { SubjectRow } from "@/lib/supabase/database.types";
import { useTableMutations } from "./crud";

export const subjectsKey = ["subjects", "active"] as const;

async function fetchSubjects(): Promise<SubjectRow[]> {
  const { data, error } = await requireSupabase()
    .from("subjects")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/** 휴지통에 있지 않은 모든 과목 (보관한 내신 과목 포함). 기록을 보여 줄 때 쓴다 */
export function useAllSubjects() {
  return useQuery({ queryKey: subjectsKey, queryFn: fetchSubjects });
}

/**
 * 고르는 목록에 쓰는 과목: 모의고사 과목(고정) 다음에 지금 배우는 내신 과목.
 * 보관한 과목은 빠진다. 타이머 숫자 단축키(1~8)도 이 순서다.
 */
export function useSubjects() {
  return useQuery({ queryKey: subjectsKey, queryFn: fetchSubjects, select: pickableSubjects });
}

export function useSubjectMutations() {
  return useTableMutations("subjects", { unique: "이미 있는 과목 이름이에요" });
}

/** 과목 id → 과목 (보관한 과목도 이름과 색을 찾을 수 있다) */
export function useSubjectMap(): Map<string, SubjectRow> {
  const { data } = useAllSubjects();
  return new Map((data ?? []).map((s) => [s.id, s]));
}
