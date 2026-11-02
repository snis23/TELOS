"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DDAY_TYPE_LABELS, DdayDialog, PERF_KIND_LABELS, PERF_STATUS_LABELS } from "@/components/dday/dday-dialog";
import { ddayPatch } from "@/components/dday/dday-editor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/data/crud";
import { ddaysKey, useDdayMutations, useDdays } from "@/lib/data/ddays";
import { useSubjectMap } from "@/lib/data/subjects";
import { formatMonthDay } from "@/lib/date/days";
import { daysLeft, ddayLabel } from "@/lib/dday/dday";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { DdayRow } from "@/lib/supabase/database.types";

const STATUS_TONE = { todo: "muted", doing: "accent", done: "ok" } as const;

/** 6.5 수행평가 탭: 마감일 순 */
export function PerfTab({ today, openId, onOpened }: { today: string; openId?: string | null; onOpened?: () => void }) {
  const { data } = useDdays();
  const subjects = useSubjectMap();
  const { insert, update, trash } = useDdayMutations();
  const [editing, setEditing] = useState<DdayRow | "new" | null>(null);
  const list = (data ?? []).filter((d) => d.type === "performance").sort((a, b) => a.date.localeCompare(b.date));
  const opened = openId ? list.find((d) => d.id === openId) : undefined;
  const current = editing ?? opened ?? null;

  const close = () => {
    setEditing(null);
    onOpened?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          수행평가 추가
        </Button>
      </div>
      {list.length === 0 ? (
        <div className="card">
          <EmptyState message="아직 수행평가가 없어요" />
        </div>
      ) : (
        <ul className="card flex flex-col">
          {list.map((d) => {
            const left = daysLeft(d.date, today);
            const subject = d.subject_id ? subjects.get(d.subject_id) : undefined;
            return (
              <li key={d.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => setEditing(d)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                  <span className="flex w-16 shrink-0 flex-col">
                    <span className={cn("num text-14 font-medium", left >= 0 && left <= 7 && d.status !== "done" ? "text-urgent-ink" : "text-ink")}>
                      {ddayLabel(d.date, today)}
                    </span>
                    <span className="text-11 text-sub">{formatMonthDay(d.date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-13 text-ink-2">{d.title}</span>
                    <span className="text-11 text-sub">
                      {subject?.name ?? "과목 없음"} · {d.perf_kind ? PERF_KIND_LABELS[d.perf_kind] : DDAY_TYPE_LABELS.performance}
                    </span>
                  </span>
                  <Badge tone={STATUS_TONE[d.status]}>
                    {PERF_STATUS_LABELS[d.status]}
                    {d.status === "doing" && d.prep_percent != null ? ` ${d.prep_percent}%` : ""}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <DdayDialog
        open={current !== null}
        dday={current === "new" ? null : current}
        defaultType="performance"
        onClose={close}
        onSubmit={(v) => {
          if (current === "new") insert.mutate({ rows: [{ id: newId(), ...ddayPatch(v) }], appendTo: ddaysKey });
          else if (current) update.mutate({ ids: [current.id], patch: ddayPatch(v) });
        }}
        onDelete={
          current && current !== "new"
            ? () => {
                trash.mutate({ id: current.id });
                close();
              }
            : undefined
        }
      />
    </div>
  );
}
