"use client";

import { useQuery } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase/client";
import type { SubjectRow } from "@/lib/supabase/database.types";
import { useTableMutations } from "./crud";

export const subjectsKey = ["subjects", "active"] as const;

/** 휴지통에 있지 않은 과목, 순서대로 */
export function useSubjects() {
  return useQuery({
    queryKey: subjectsKey,
    queryFn: async (): Promise<SubjectRow[]> => {
      const { data, error } = await requireSupabase()
        .from("subjects")
        .select("*")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useSubjectMutations() {
  return useTableMutations("subjects", { unique: "이미 있는 과목 이름이에요" });
}

/** 과목 id → 과목 */
export function useSubjectMap(): Map<string, SubjectRow> {
  const { data } = useSubjects();
  return new Map((data ?? []).map((s) => [s.id, s]));
}
