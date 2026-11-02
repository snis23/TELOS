"use client";

import { useQuery } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase/client";
import type { TableName, TableRows } from "@/lib/supabase/database.types";

/**
 * 휴지통에 없는 행 전체를 불러오는 공통 쿼리. 키: [테이블, "all"]
 * 개인 한 명의 데이터라 대부분의 표는 통째로 불러와도 작다.
 */
const PAGE_SIZE = 1000;

export function useAllRows<T extends TableName>(
  table: T,
  options: { orderBy?: string; enabled?: boolean; includeDeleted?: boolean } = {},
) {
  const { orderBy = "created_at", enabled = true, includeDeleted = false } = options;
  return useQuery({
    queryKey: [table, "all", orderBy, includeDeleted],
    enabled,
    queryFn: async (): Promise<TableRows[T][]> => {
      // Supabase 는 한 번에 최대 1000행을 돌려주므로 나눠서 받는다
      const out: TableRows[T][] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        let q = requireSupabase().from(table).select("*");
        if (!includeDeleted) q = q.is("deleted_at", null);
        const { data, error } = await q
          .order(orderBy, { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        out.push(...(data as unknown as TableRows[T][]));
        if (!data || data.length < PAGE_SIZE) break;
      }
      return out;
    },
  });
}

export const allKey = (table: TableName, orderBy = "created_at") => [table, "all", orderBy, false] as const;
