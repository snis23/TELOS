"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";

/**
 * 다른 기기에서 바뀐 내용을 바로 반영한다 (2장 실시간 동기화, 10.1 두 기기 동시 수정).
 * 바뀐 테이블의 쿼리를 다시 불러온다. 마지막 저장이 우선이다. RLS 때문에 내 행만 온다.
 */
export function useRealtimeSync(userId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`telos-sync-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public" }, (payload: { table?: string }) => {
        if (payload.table) void queryClient.invalidateQueries({ queryKey: [payload.table] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
