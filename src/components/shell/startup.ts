"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/lib/data/profile";
import { cleanupPendingFiles } from "@/lib/data/file-cleanup";
import { ensureRecentStats } from "@/lib/data/stats";
import { ensureRecurrenceTasks } from "@/lib/data/tasks";
import { useToday } from "@/lib/data/today";

/**
 * 앱을 열 때(그리고 새 날이 될 때) 하는 일:
 * - 그날의 반복 할 일 만들기 (5.6)
 * - 하루 한 번 지운 오답 사진 파일 정리 (9.3)
 * - 빠진 날의 하루 통계 채우기 (9.3 보충)
 */
export function useAppStartup() {
  const today = useToday();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const dayStartHour = profile?.day_start_hour;

  useEffect(() => {
    if (dayStartHour === undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const created = await ensureRecurrenceTasks(today, dayStartHour);
        if (!cancelled && created) void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } catch (error) {
        console.error("반복 할 일을 만들지 못했어요", error);
      }
      try {
        if (await ensureRecentStats(today)) void queryClient.invalidateQueries({ queryKey: ["daily_stats"] });
      } catch (error) {
        console.error("통계를 채우지 못했어요", error);
      }
      try {
        await cleanupPendingFiles(today);
      } catch (error) {
        console.error("사진 파일을 정리하지 못했어요. 다음에 다시 해요", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today, dayStartHour, queryClient]);
}
