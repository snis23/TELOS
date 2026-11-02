"use client";

import { useQuery } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase/client";
import type { ReflectionRow } from "@/lib/supabase/database.types";

export const reflectionKey = (date: string) => ["reflections", "date", date] as const;

export function useReflection(date: string) {
  return useQuery({
    queryKey: reflectionKey(date),
    queryFn: async (): Promise<ReflectionRow | null> => {
      const { data, error } = await requireSupabase()
        .from("reflections")
        .select("*")
        .eq("study_date", date)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** 회고 저장: 하루에 하나 (없으면 만들고 있으면 고친다) */
export async function saveReflection(row: Pick<ReflectionRow, "id" | "study_date" | "good" | "bad" | "tomorrow" | "condition">) {
  const { error } = await requireSupabase().from("reflections").upsert(row, { onConflict: "id" });
  if (error) throw error;
}
