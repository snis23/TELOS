"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useSaveErrorToast } from "@/lib/data/save-error";
import { formatMonthDay } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import { TABLE_LABELS } from "@/lib/backup/backup";
import { requireSupabase } from "@/lib/supabase/client";
import { useNow } from "@/lib/use-now";
import { TRASHABLE_TABLES, type TrashableTable } from "@/lib/supabase/database.types";

const KEEP_DAYS = 7;

type Item = { table: TrashableTable; id: string; label: string; deletedAt: string; together: number };

function labelOf(row: Record<string, unknown>): string {
  for (const k of ["title", "name", "front", "source", "date", "study_date"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  if (typeof row.question_no === "number") return `${row.question_no}번`;
  if (typeof row.started_at === "string") return `${formatMonthDay(getStudyDate(new Date(row.started_at)))} 기록`;
  return "이름 없음";
}

/** 9.4 휴지통: 종류별 목록과 남은 보관 기간. [복원] [바로 삭제]. 함께 지운 것은 한 묶음 */
export function TrashCard() {
  const queryClient = useQueryClient();
  const onSaveError = useSaveErrorToast();
  const [purging, setPurging] = useState<Item | null>(null);
  const now = useNow(60_000);
  const { data, isPending } = useQuery({
    queryKey: ["trash"],
    queryFn: async (): Promise<Item[]> => {
      const supabase = requireSupabase();
      const results = await Promise.all(
        TRASHABLE_TABLES.map(async (table) => {
          const { data: rows, error } = await supabase.from(table).select("*").not("deleted_at", "is", null);
          if (error) throw error;
          return { table, rows: (rows ?? []) as unknown as Record<string, unknown>[] };
        }),
      );
      const all = results.flatMap((r) => r.rows.map((row) => ({ table: r.table, row })));
      return all
        .filter(({ row }) => row.delete_batch_id === row.id)
        .map(({ table, row }) => ({
          table,
          id: row.id as string,
          label: labelOf(row),
          deletedAt: row.deleted_at as string,
          together: all.filter((x) => x.row.delete_batch_id === row.id && x.row.id !== row.id).length,
        }))
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    },
  });

  const run = async (fn: "restore_batch" | "purge_batch", id: string) => {
    try {
      const { error } = await requireSupabase().rpc(fn, { p_batch: id });
      if (error) throw error;
    } catch (error) {
      onSaveError(error, () => void run(fn, id), { unique: "같은 이름이 있어서 되돌리지 못했어요" });
    } finally {
      await queryClient.invalidateQueries();
    }
  };

  const daysLeft = (deletedAt: string) => Math.max(0, KEEP_DAYS - Math.floor((now.getTime() - new Date(deletedAt).getTime()) / 86_400_000));
  const items = data ?? [];
  const groups = [...new Set(items.map((i) => i.table))];

  return (
    <Card title="휴지통">
      {isPending ? (
        <p className="text-13 text-sub">불러오는 중</p>
      ) : items.length === 0 ? (
        <EmptyState message="휴지통이 비어 있어요" />
      ) : (
        <div className="flex flex-col gap-4" data-testid="trash-list">
          {groups.map((table) => (
            <section key={table} aria-label={TABLE_LABELS[table]}>
              <h3 className="mb-1 text-12 text-sub">{TABLE_LABELS[table]}</h3>
              <ul className="flex flex-col">
                {items
                  .filter((i) => i.table === table)
                  .map((i) => (
                    <li key={i.id} className="flex min-h-11 flex-wrap items-center gap-2 border-b border-line py-1 last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-13 text-ink-2">{i.label}</span>
                        <span className="text-11 text-sub">
                          {daysLeft(i.deletedAt)}일 뒤 완전히 삭제{i.together ? ` · 함께 지운 항목 ${i.together}개` : ""}
                        </span>
                      </span>
                      <Button variant="secondary" onClick={() => void run("restore_batch", i.id)}>
                        복원
                      </Button>
                      <Button variant="danger" onClick={() => setPurging(i)}>
                        바로 삭제
                      </Button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={purging !== null}
        title="바로 삭제할까요?"
        message={`"${purging?.label ?? ""}"${purging?.together ? `과 함께 지운 ${purging.together}개` : ""}를 완전히 지워요. 되돌릴 수 없어요.`}
        confirmLabel="완전히 삭제"
        danger
        onConfirm={() => purging && void run("purge_batch", purging.id)}
        onClose={() => setPurging(null)}
      />
    </Card>
  );
}
