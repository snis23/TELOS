"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/auth-provider";
import { requireSupabase } from "@/lib/supabase/client";
import type { TableName, TableRows, TrashableTable } from "@/lib/supabase/database.types";
import { useSaveErrorToast } from "./save-error";

/**
 * 테이블 공통 저장 처리 (10.1).
 * 모든 저장은 화면에 먼저 반영하고(낙관적 업데이트), 실패하면 되돌린 뒤 "저장하지 못했어요 [다시 시도]".
 * 쿼리 키는 [테이블 이름, ...조건] 규칙을 따른다. 그래서 [테이블]로 관련 목록을 한 번에 고칠 수 있다.
 */

type Snapshot = [QueryKey, unknown][];
type AnyRow = { id: string } & Record<string, unknown>;

function mapCached(data: unknown, fn: (row: AnyRow) => AnyRow | null): unknown {
  if (Array.isArray(data)) {
    return (data as AnyRow[]).map(fn).filter((r): r is AnyRow => r !== null);
  }
  if (data && typeof data === "object" && "id" in data) return fn(data as AnyRow) ?? null;
  return data;
}

/** 테이블 이름을 변수로 받는 공통 처리용 (타입은 호출하는 쪽에서 보장한다) */
type LooseBuilder = {
  insert(rows: unknown): PromiseLike<{ error: unknown }>;
  update(patch: unknown): { in(column: string, values: string[]): PromiseLike<{ error: unknown }> };
};
export function looseTable(table: TableName): LooseBuilder {
  return requireSupabase().from(table) as unknown as LooseBuilder;
}

export function newId(): string {
  return crypto.randomUUID();
}

export type ErrorMessages = { unique?: string };

export function useTableMutations<T extends TableName>(table: T, messages?: ErrorMessages) {
  type Row = TableRows[T];
  const queryClient = useQueryClient();
  const onSaveError = useSaveErrorToast();
  const toast = useToast();
  const auth = useAuth();
  const userId = auth.status === "signed-in" ? auth.userId : "";
  const tableKey = [table] as const;

  const snapshot = async (): Promise<Snapshot> => {
    await queryClient.cancelQueries({ queryKey: tableKey });
    return queryClient.getQueriesData({ queryKey: tableKey });
  };
  const rollback = (snap: Snapshot | undefined) => {
    for (const [key, data] of snap ?? []) queryClient.setQueryData(key, data);
  };
  const settle = () => queryClient.invalidateQueries({ queryKey: tableKey });

  const fill = (row: Partial<Row>): Row => {
    const now = new Date().toISOString();
    return {
      user_id: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      delete_batch_id: null,
      ...row,
      id: (row as AnyRow).id ?? newId(),
    } as unknown as Row;
  };

  const insert = useMutation({
    mutationFn: async (vars: { rows: Partial<Row>[]; appendTo?: QueryKey }) => {
      const { error } = await looseTable(table).insert(vars.rows);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const snap = await snapshot();
      if (vars.appendTo) {
        queryClient.setQueryData<Row[]>(vars.appendTo, (old) => (old ? [...old, ...vars.rows.map(fill)] : old));
      }
      return { snap };
    },
    onError: (error, vars, context) => {
      rollback(context?.snap);
      onSaveError(error, () => {
        insert.mutate(vars);
      }, messages);
    },
    onSettled: settle,
  });

  const update = useMutation({
    mutationFn: async (vars: { ids: string[]; patch: Partial<Row> }) => {
      const { error } = await looseTable(table).update(vars.patch).in("id", vars.ids);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const snap = await snapshot();
      const ids = new Set(vars.ids);
      queryClient.setQueriesData({ queryKey: tableKey }, (data: unknown) =>
        mapCached(data, (row) => (ids.has(row.id) ? { ...row, ...(vars.patch as object) } : row)),
      );
      return { snap };
    },
    onError: (error, vars, context) => {
      rollback(context?.snap);
      onSaveError(error, () => {
        update.mutate(vars);
      }, messages);
    },
    onSettled: settle,
  });

  const restore = useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await requireSupabase().rpc("restore_batch", { p_batch: batchId });
      if (error) throw error;
    },
    onError: (error, batchId) => {
      onSaveError(error, () => {
        restore.mutate(batchId);
      }, { unique: "같은 이름이 있어서 되돌리지 못했어요" });
    },
    // 함께 지운 다른 테이블도 돌아오므로 전부 다시 불러온다
    onSettled: () => queryClient.invalidateQueries(),
  });

  const trash = useMutation({
    mutationFn: async (vars: { id: string; silent?: boolean }) => {
      const { error } = await requireSupabase().rpc("trash_item", {
        p_table: table as TrashableTable,
        p_id: vars.id,
      });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const snap = await snapshot();
      queryClient.setQueriesData({ queryKey: tableKey }, (data: unknown) =>
        mapCached(data, (row) => (row.id === vars.id ? null : row)),
      );
      return { snap };
    },
    onSuccess: (_data, vars) => {
      if (vars.silent) return;
      toast.show({
        message: "삭제했어요",
        action: {
          label: "되돌리기",
          onClick: () => {
            restore.mutate(vars.id);
          },
        },
      });
    },
    onError: (error, vars, context) => {
      rollback(context?.snap);
      onSaveError(error, () => {
        trash.mutate(vars);
      });
    },
    onSettled: () => queryClient.invalidateQueries(),
  });

  const reorder = useMutation({
    mutationFn: async (vars: { ids: string[]; key: QueryKey }) => {
      const { error } = await requireSupabase().rpc("reorder_rows", { p_table: table, p_ids: vars.ids });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const snap = await snapshot();
      const col = table === "ddays" ? "pin_order" : "sort_order";
      queryClient.setQueryData<AnyRow[]>(vars.key, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((r) => [r.id, r]));
        const ordered = vars.ids.map((id, i) => {
          const row = byId.get(id);
          return row ? { ...row, [col]: i } : null;
        });
        const rest = old.filter((r) => !vars.ids.includes(r.id));
        return [...ordered.filter((r): r is AnyRow => r !== null), ...rest];
      });
      return { snap };
    },
    onError: (error, vars, context) => {
      rollback(context?.snap);
      onSaveError(error, () => {
        reorder.mutate(vars);
      });
    },
    onSettled: settle,
  });

  return { insert, update, trash, restore, reorder };
}
