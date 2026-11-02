"use client";

import { useMemo, useState } from "react";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { SubjectTag } from "@/components/ui/tag";
import { useDdays, useRoadmapItems } from "@/lib/data/ddays";
import { useDayStartHour } from "@/lib/data/profile";
import { useAllRows } from "@/lib/data/queries";
import { useSubjectMap } from "@/lib/data/subjects";
import { useTasks } from "@/lib/data/tasks";
import { useDayTimetable } from "@/lib/data/timetable";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { roadmapCandidates, roundLabel } from "@/lib/exam/roadmap";
import type { RoadmapItemRow } from "@/lib/supabase/database.types";
import { formatDayMin } from "@/lib/timetable/time";

/**
 * 로드맵 달력의 계획을 그날 할 일로 골라 넣는다 (자동으로 넣지 않는다).
 * 넣을 차시를 고르면 그 차시 시간에 배정한다.
 */
export function RoadmapPicker({
  open,
  onClose,
  date,
  preselect,
}: {
  open: boolean;
  onClose: () => void;
  /** 할 일을 넣을 날짜 */
  date: string;
  preselect?: readonly string[];
}) {
  if (!open) return null;
  return <PickerBody onClose={onClose} date={date} preselect={preselect ?? []} />;
}

function PickerBody({ onClose, date, preselect }: { onClose: () => void; date: string; preselect: readonly string[] }) {
  const dayStartHour = useDayStartHour();
  const { data: items } = useRoadmapItems();
  const { data: ddays } = useDdays();
  const { data: allTasks } = useAllRows("tasks", { orderBy: "study_date" });
  const { data: dayTasks } = useTasks(date);
  const { slots } = useDayTimetable(date);
  const subjects = useSubjectMap();
  const actions = useTaskActions(date, dayTasks ?? []);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(preselect));
  const [slotId, setSlotId] = useState("");

  const examTitle = useMemo(() => new Map((ddays ?? []).map((d) => [d.id, d.title])), [ddays]);
  const linked = useMemo(
    () => new Set((allTasks ?? []).map((t) => t.roadmap_item_id).filter((x): x is string => Boolean(x))),
    [allTasks],
  );
  const groups = useMemo(() => {
    const c = roadmapCandidates(items ?? [], linked, date);
    // 미리 고른 칸이 다가오는 7일 밖이어도 보이게 한다
    const shown = new Set([...c.today, ...c.overdue, ...c.upcoming].map((i) => i.id));
    const extra = (items ?? []).filter((i) => preselect.includes(i.id) && !shown.has(i.id) && !linked.has(i.id) && !i.deleted_at);
    return [
      { label: "이날 계획", list: c.today },
      { label: "밀린 계획", list: c.overdue },
      { label: "다가오는 계획", list: [...extra, ...c.upcoming] },
    ].filter((g) => g.list.length > 0);
  }, [items, linked, date, preselect]);

  const studySlots = slots.filter((s) => s.category === "study" || s.category === "class");
  const chosen = (items ?? []).filter((i) => picked.has(i.id));
  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const row = (item: RoadmapItemRow) => {
    const s = subjects.get(item.subject_id);
    return (
      <label key={item.id} className="flex min-h-11 items-center gap-2 border-b border-line py-1 last:border-b-0">
        <Checkbox checked={picked.has(item.id)} onChange={(v) => toggle(item.id, v)} label={`${item.content} 고르기`} />
        {s ? <SubjectTag name={s.name} color={s.color_key} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-13 text-ink">{item.content}</span>
          <span className="block text-11 text-sub">
            {formatMonthDayWeekday(item.study_date)} · {examTitle.get(item.dday_id) ?? ""}
            {item.round ? ` · ${roundLabel(item.round)}` : ""}
          </span>
        </span>
      </label>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`로드맵에서 할 일 가져오기 · ${formatMonthDayWeekday(date)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={chosen.length === 0}
            onClick={() => {
              actions.addFromRoadmap(chosen, slotId || null);
              onClose();
            }}
          >
            {chosen.length ? `${chosen.length}개 넣기` : "넣기"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <EmptyState message="가져올 로드맵 계획이 없어요. 시험 대비 화면의 달력에 계획을 적어 보세요." />
        ) : (
          groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h3 className="mb-1 text-12 text-sub">{g.label}</h3>
              <div className="flex flex-col">{g.list.map(row)}</div>
            </section>
          ))
        )}
        <SelectField
          label="넣을 시간"
          value={slotId}
          onChange={setSlotId}
          options={[
            { value: "", label: "시간 정하지 않음 (나중에 시간 보기에서 옮기기)" },
            ...studySlots.map((s) => ({
              value: s.id,
              label: `${s.name} ${formatDayMin(s.start_min, dayStartHour)}–${formatDayMin(s.end_min, dayStartHour)}`,
            })),
          ]}
        />
      </div>
    </Dialog>
  );
}
