"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { NameDialog } from "@/components/settings/timetable-settings";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { SortableList } from "@/components/ui/sortable";
import { SubjectDot } from "@/components/ui/subject-dot";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/data/crud";
import { useUnitMutations, useUnits } from "@/lib/data/plan";
import { useSubjects } from "@/lib/data/subjects";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { SubjectRow, UnitRow, UnitStatus } from "@/lib/supabase/database.types";

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = { todo: "안 함", doing: "진행 중", done: "완료" };
const unitsKey = ["units", "all", "sort_order", false] as const;

/** 과목 진도율 = 완료 단원 비율 (6.4) */
export function unitProgress(units: readonly Pick<UnitRow, "status">[]): number {
  return units.length ? units.filter((u) => u.status === "done").length / units.length : 0;
}

/** 6.4 진행표: 과목마다 단원 목록과 상태 */
export function ProgressTable() {
  const { data: subjects } = useSubjects();
  const { data: units } = useUnits();
  const list = subjects ?? [];
  if (list.length === 0) return <EmptyState message="과목을 먼저 추가해 주세요" />;
  return (
    <div className="grid gap-6 land:grid-cols-2">
      {list.map((s) => (
        <SubjectUnits key={s.id} subject={s} units={(units ?? []).filter((u) => u.subject_id === s.id)} />
      ))}
    </div>
  );
}

function SubjectUnits({ subject, units }: { subject: SubjectRow; units: UnitRow[] }) {
  const { insert, update, trash, reorder } = useUnitMutations();
  const [dialog, setDialog] = useState<UnitRow | "new" | null>(null);
  const p = unitProgress(units);
  return (
    <section className="card flex flex-col gap-3" aria-label={`${subject.name} 진행표`} data-subject={subject.color_key}>
      <header className="flex items-center gap-2">
        <SubjectDot color={subject.color_key} />
        <h2 className="flex-1 text-14 font-semibold">{subject.name}</h2>
        <span className="num text-13 text-sub">{Math.round(p * 100)}%</span>
        <IconButton aria-label={`${subject.name} 단원 추가`} onClick={() => setDialog("new")}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
        </IconButton>
      </header>
      <ProgressBar value={p} label={`${subject.name} 진도율`} tone="subject" />
      {units.length === 0 ? (
        <p className="text-12 text-sub">아직 단원이 없어요</p>
      ) : (
        <SortableList items={units} onReorder={(ids) => reorder.mutate({ ids, key: unitsKey })}>
          {(u, handle) => (
            <div className="flex min-h-10 items-center gap-2 border-b border-line last:border-b-0">
              {handle}
              <span className={cn("min-w-0 flex-1 truncate text-13", u.status === "done" ? "text-sub" : "text-ink-2")}>{u.name}</span>
              <div role="radiogroup" aria-label={`${u.name} 상태`} className="flex gap-0.5 rounded-input bg-surface-2 p-0.5">
                {(["todo", "doing", "done"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    role="radio"
                    aria-checked={u.status === st}
                    onClick={() => update.mutate({ ids: [u.id], patch: { status: st } })}
                    className={cn(
                      "hit h-7 rounded-key px-2 text-11",
                      u.status === st
                        ? st === "done"
                          ? "bg-ok-soft font-semibold text-ok-ink"
                          : st === "doing"
                            ? "bg-nav-on font-semibold text-accent-strong"
                            : "bg-surface font-semibold text-ink"
                        : "text-ink-2",
                    )}
                  >
                    {UNIT_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
              <IconButton aria-label={`${u.name} 이름 바꾸기`} onClick={() => setDialog(u)}>
                <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
              </IconButton>
              <IconButton aria-label={`${u.name} 삭제`} onClick={() => trash.mutate({ id: u.id })}>
                <Trash2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
              </IconButton>
            </div>
          )}
        </SortableList>
      )}
      {dialog ? (
        <NameDialog
          title={dialog === "new" ? `${subject.name} 단원 추가` : "단원 이름 바꾸기"}
          label="단원 이름"
          max={40}
          initial={dialog === "new" ? "" : dialog.name}
          onClose={() => setDialog(null)}
          onSubmit={(name) =>
            dialog === "new"
              ? insert.mutate({ rows: [{ id: newId(), subject_id: subject.id, name, sort_order: units.length }], appendTo: unitsKey })
              : update.mutate({ ids: [dialog.id], patch: { name } })
          }
        />
      ) : null}
    </section>
  );
}
