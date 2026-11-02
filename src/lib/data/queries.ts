"use client";

import { useQuery } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase/client";
import type { TableName, TableRows } from "@/lib/supabase/database.types";

/**
 * 휴지통에 없는 행 전체를 불러오는 공통 쿼리. 키: [테이블, "all"]
 * 개인 한 명의 데이터라 대부분의 표는 통째로 불러와도 작다.
 */
export function useAllRows<T extends TableName>(
  table: T,
  options: { orderBy?: string; enabled?: boolean; includeDeleted?: boolean } = {},
) {
  const { orderBy = "created_at", enabled = true, includeDeleted = false } = options;
  return useQuery({
    queryKey: [table, "all", orderBy, includeDeleted],
    enabled,
    queryFn: async (): Promise<TableRows[T][]> => {
      let q = requireSupabase().from(table).select("*");
      if (!includeDeleted) q = q.is("deleted_at", null);
      const { data, error } = await q.order(orderBy, { ascending: true });
      if (error) throw error;
      return data as unknown as TableRows[T][];
    },
  });
}

export const allKey = (table: TableName, orderBy = "created_at") => [table, "all", orderBy, false] as const;
