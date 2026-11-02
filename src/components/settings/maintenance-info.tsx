"use client";

import { useQuery } from "@tanstack/react-query";
import { formatClock, formatMonthDay } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import { requireSupabase } from "@/lib/supabase/client";

/** 9.3-4 "마지막 자동 정리: 11월 2일 06:10" */
export function MaintenanceInfo() {
  const { data } = useQuery({
    queryKey: ["maintenance_runs", "last"],
    queryFn: async () => {
      const { data: rows, error } = await requireSupabase()
        .from("maintenance_runs")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return rows[0] ?? null;
    },
  });
  if (data === undefined) return null;
  if (!data) return <p className="text-12 text-sub">아직 자동 정리 기록이 없어요. pg_cron 설정을 확인해 주세요</p>;
  const at = new Date(data.ran_at);
  return (
    <p className="text-12 text-sub" data-testid="maintenance-info">
      마지막 자동 정리: {formatMonthDay(getStudyDate(at, 0))} {formatClock(at)}
      {data.ok ? "" : " · 실패해서 다음 날 다시 해요"}
    </p>
  );
}
