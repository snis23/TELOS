"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/lib/data/profile";
import { cleanupPendingFiles } from "@/lib/data/file-cleanup";
import { ensureRangeTasks } from "@/lib/data/range-tasks";
import { ensureRecurrenceTasks } from "@/lib/data/tasks";
import { useToday } from "@/lib/data/today";

/**
 * 앱을 열 때(그리고 새 날이 될 때) 하는 일:
 * - 그날의 반복 할 일 만들기 (5.6)
 * - 시험 범위 분배 할 일 만들기 (6.5)
 * - 하루 한 번 지운 오답 사진 파일 정리 (9.3)
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
        const created = (await ensureRecurrenceTasks(today, dayStartHour)) + (await ensureRangeTasks(today));
        if (!cancelled && created) void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } catch (error) {
        console.error("반복 할 일을 만들지 못했어요", error);
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
