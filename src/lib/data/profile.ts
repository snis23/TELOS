"use client";

import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@/lib/auth/auth-provider";
import { requireSupabase } from "@/lib/supabase/client";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { DEFAULT_DAY_START_HOUR } from "@/lib/date/study-date";
import { termOf, type Term } from "@/lib/subjects/subjects";
import { useTableMutations } from "./crud";

export const profileKey = ["profiles", "me"] as const;

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKey,
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await requireSupabase()
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** 하루 기준 시각 (불러오기 전에는 기본값 6) */
export function useDayStartHour(): number {
  return useProfile().data?.day_start_hour ?? DEFAULT_DAY_START_HOUR;
}

export type ProfilePatch = Partial<Omit<ProfileRow, "id" | "user_id" | "created_at" | "updated_at">>;

/** 설정 저장: 화면에 먼저 반영하고 실패하면 되돌린다 */
export function useUpdateProfile() {
  const { data: profile } = useProfile();
  const { update } = useTableMutations("profiles");
  return {
    mutate: (patch: ProfilePatch) => {
      if (profile) update.mutate({ ids: [profile.id], patch });
    },
    isPending: update.isPending,
  };
}

/** 오늘(공부 날짜)이 속한 학기와 학년 (입학 연도가 없으면 학년은 null) */
export function useTerm(today: string): Term {
  const { data: profile } = useProfile();
  return termOf(
    today,
    { sem1_start: profile?.sem1_start ?? "03-01", sem2_start: profile?.sem2_start ?? "08-01" },
    profile?.entry_year ?? null,
  );
}
