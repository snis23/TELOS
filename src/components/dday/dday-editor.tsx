"use client";

import { useMemo, useState } from "react";
import { Pin, PinOff, Plus } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableList } from "@/components/ui/sortable";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/data/crud";
import { ddaysKey, examSubjectsKey, useDdayMutations, useDdays, useExamSubjectMutations } from "@/lib/data/ddays";
import { useAllSubjects } from "@/lib/data/subjects";
import { subjectsForExam } from "@/lib/subjects/subjects";
import { useToday } from "@/lib/data/today";
import { formatMonthDay } from "@/lib/date/days";
import { ddayLabel, isUpcoming } from "@/lib/dday/dday";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { DdayRow } from "@/lib/supabase/database.types";
import { DDAY_TYPE_LABELS, DdayDialog, type DdayFormValues } from "./dday-dialog";

export function ddayPatch(v: DdayFormValues): Partial<DdayRow> {
  return {
    type: v.type,
    title: v.title,
    date: v.date,
    subject_id: v.subject_id,
    perf_kind: v.perf_kind,
    status: v.status,
    prep_percent: v.prep_percent,
    memo: v.memo || null,
    exam_kind: v.exam_kind,
  };
}

/** 일정 추가. 시험이면 종류에 맞는 과목을 시험 과목으로 함께 넣는다 (시험 대비 로드맵). 새 id 를 돌려준다 */
export function useCreateDday() {
  const { insert } = useDdayMutations();
  const examSubjects = useExamSubjectMutations();
  const { data: allSubjects } = useAllSubjects();
  return (v: DdayFormValues): string => {
    const id = newId();
    insert.mutate({ rows: [{ id, ...ddayPatch(v) }], appendTo: ddaysKey });
    if (v.type === "exam") {
      examSubjects.insert.mutate({
        rows: subjectsForExam(v.exam_kind, allSubjects ?? []).map((s, i) => ({ id: newId(), dday_id: id, subject_id: s.id, sort_order: i })),
        appendTo: examSubjectsKey,
      });
    }
    return id;
  };
}

/**
 * D-day 목록 편집 (5.3, 6.5 일정 탭): 고정됨(끌어서 순서) → 다가오는 일정(날짜순) → 지난 일정(접힘).
 * 고정 아이콘을 누르면 고정된다. 홈의 "편집" 버튼도 이 목록을 연다.
 */
export function DdayList({ onOpenDetail }: { onOpenDetail?: (d: DdayRow) => void }) {
  const today = useToday();
  const { data } = useDdays();
  const { update, trash, reorder } = useDdayMutations();
  const create = useCreateDday();
  const [editing, setEditing] = useState<DdayRow | "new" | null>(null);
  const [showPast, setShowPast] = useState(false);
  const all = useMemo(() => data ?? [], [data]);
  const pinned = useMemo(
    () => all.filter((d) => d.pinned && isUpcoming(d, today)).sort((a, b) => a.pin_order - b.pin_order),
    [all, today],
  );
  const upcoming = all.filter((d) => !d.pinned && isUpcoming(d, today));
  const past = all.filter((d) => !isUpcoming(d, today)).sort((a, b) => b.date.localeCompare(a.date));

  const togglePin = (d: DdayRow) =>
    update.mutate({ ids: [d.id], patch: d.pinned ? { pinned: false } : { pinned: true, pin_order: pinned.length } });

  const row = (d: DdayRow, handle?: React.ReactNode) => (
    <div className="flex min-h-11 items-center gap-2 border-b border-line py-1 last:border-b-0">
      {handle}
      <button type="button" onClick={() => (onOpenDetail ? onOpenDetail(d) : setEditing(d))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="num w-14 shrink-0 text-13 font-medium">{ddayLabel(d.date, today)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-13 text-ink-2">{d.title}</span>
          <span className="text-11 text-sub">
            {DDAY_TYPE_LABELS[d.type]} · {formatMonthDay(d.date)}
          </span>
        </span>
      </button>
      <IconButton aria-label={d.pinned ? `${d.title} 고정 풀기` : `${d.title} 고정`} aria-pressed={d.pinned} onClick={() => togglePin(d)}>
        {d.pinned ? (
          <Pin size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} className="text-accent-strong" />
        ) : (
          <PinOff size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
        )}
      </IconButton>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          일정 추가
        </Button>
      </div>
      {all.length === 0 ? <EmptyState message="아직 D-day 가 없어요" /> : null}
      {pinned.length ? (
        <section>
          <h3 className="mb-1 text-12 text-sub">고정됨</h3>
          <SortableList items={pinned} onReorder={(ids) => reorder.mutate({ ids, key: ddaysKey })}>
            {(d, handle) => row(d, handle)}
          </SortableList>
        </section>
      ) : null}
      {upcoming.length ? (
        <section>
          <h3 className="mb-1 text-12 text-sub">다가오는 일정</h3>
          {upcoming.map((d) => (
            <div key={d.id}>{row(d)}</div>
          ))}
        </section>
      ) : null}
      {past.length ? (
        <section>
          <button type="button" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)} className="mb-1 text-12 text-sub">
            지난 일정 {past.length}개 {showPast ? "접기" : "보기"}
          </button>
          <div className={cn(!showPast && "hidden")}>
            {past.map((d) => (
              <div key={d.id}>{row(d)}</div>
            ))}
          </div>
        </section>
      ) : null}

      <DdayDialog
        open={editing !== null}
        dday={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSubmit={(v) => {
          if (editing === "new") create(v);
          else if (editing) update.mutate({ ids: [editing.id], patch: ddayPatch(v) });
        }}
        onDelete={
          editing && editing !== "new"
            ? () => {
                trash.mutate({ id: editing.id });
                setEditing(null);
              }
            : undefined
        }
      />
    </div>
  );
}

/** 홈 D-day 영역의 "편집" 창 */
export function DdayEditorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="D-day 편집">
      <DdayList />
    </Dialog>
  );
}
