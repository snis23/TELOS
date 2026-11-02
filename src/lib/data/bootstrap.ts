"use client";

import { useQuery } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase/client";

/** 처음 로그인하면 프로필과 기본 과목을 만든다. 이미 있으면 아무 일도 하지 않는다. */
export function useBootstrap(userId: string | null) {
  return useQuery({
    queryKey: ["bootstrap", userId ?? "none"],
    enabled: Boolean(userId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const { error } = await requireSupabase().rpc("bootstrap_user");
      if (error) throw error;
      return true;
    },
  });
}
