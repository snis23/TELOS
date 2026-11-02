"use client";

import { useQuery } from "@tanstack/react-query";
import { addDays } from "@/lib/date/days";
import { requireSupabase } from "@/lib/supabase/client";
import type { DailyStatRow, TaskDeferralRow, TaskRow } from "@/lib/supabase/database.types";

/** 최근 n일의 daily_stats (나눠 받기) */
export function useDailyStats(today: string, days = 400) {
  const from = addDays(today, -days);
  return useQuery({
    queryKey: ["daily_stats", "since", from],
    queryFn: async (): Promise<DailyStatRow[]> => {
      const out: DailyStatRow[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await requireSupabase()
          .from("daily_stats")
          .select("*")
          .gte("study_date", from)
          .order("study_date", { ascending: true })
          .order("id", { ascending: true })
          .range(start, start + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) break;
      }
      return out;
    },
  });
}

export function useDeferrals(today: string) {
  const from = addDays(today, -31);
  return useQuery({
    queryKey: ["task_deferrals", "since", from],
    queryFn: async (): Promise<TaskDeferralRow[]> => {
      const { data, error } = await requireSupabase().from("task_deferrals").select("*").gte("from_date", from);
      if (error) throw error;
      return data;
    },
  });
}

/** 지난 30일의 반복 할 일 (못 한 비율) */
export function useRecentRecurringTasks(today: string) {
  const from = addDays(today, -31);
  return useQuery({
    queryKey: ["tasks", "recurring-since", from],
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await requireSupabase()
        .from("tasks")
        .select("*")
        .gte("study_date", from)
        .not("recurrence_id", "is", null)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * 빠진 날의 통계 채우기: 어제 통계가 없으면 최근 7일을 다시 계산한다
 * (매일 자동 작업이 실패했거나 아직 켜지 않았을 때)
 */
export async function ensureRecentStats(today: string): Promise<boolean> {
  const yesterday = addDays(today, -1);
  const supabase = requireSupabase();
  const { count, error } = await supabase
    .from("daily_stats")
    .select("id", { count: "exact", head: true })
    .eq("study_date", yesterday);
  if (error) throw error;
  if ((count ?? 0) > 0) return false;
  const res = await supabase.rpc("refresh_daily_stats", { p_from: addDays(today, -7), p_to: yesterday });
  if (res.error) throw res.error;
  return true;
}
