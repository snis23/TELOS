"use client";

import { useMemo, useState } from "react";
import { ROADMAP_CONTENT_MAX } from "@/components/exam/day-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { SubjectTag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { newId, useTableMutations } from "@/lib/data/crud";
import { roadmapKey, useDdays, useExamSubjects, useRoadmapItems } from "@/lib/data/ddays";
import { useAllSubjects, useSubjectMap } from "@/lib/data/subjects";
import { useTasks } from "@/lib/data/tasks";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { examsForSubject } from "@/lib/exam/roadmap";
import { subjectsForExam } from "@/lib/subjects/subjects";
import type { DdayRow, TaskRow } from "@/lib/supabase/database.types";

/**
 * 그날 할 일을 골라 시험 로드맵 달력에 올린다 (로드맵에서 가져오기의 반대 방향, 자동으로 올리지 않는다).
 * 올린 할 일은 로드맵 칸과 이어져서, 어느 쪽에서 체크해도 둘 다 체크된다.
 */
export function RoadmapPusher({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  if (!open) return null;
  return <PusherBody onClose={onClose} date={date} />;
}

function PusherBody({ onClose, date }: { onClose: () => void; date: string }) {
  const toast = useToast();
  const { data: dayTasks } = useTasks(date);
  const { data: ddays } = useDdays();
  const { data: examSubjects } = useExamSubjects();
  const { data: items } = useRoadmapItems();
  const { data: allSubjects } = useAllSubjects();
  const subjects = useSubjectMap();
  const roadmap = useTableMutations("roadmap_items");
  const tasks = useTableMutations("tasks");

  /** 올릴 수 있는 할 일: 과목이 있고 아직 로드맵과 이어지지 않은 것 */
  const candidates = useMemo(
    () => (dayTasks ?? []).filter((t): t is TaskRow & { subject_id: string } => Boolean(t.subject_id) && !t.roadmap_item_id && !t.deleted_at),
    [dayTasks],
  );
  /** 할 일 id → 올릴 수 있는 시험들 */
  const examsByTask = useMemo(() => {
    const fallback = (exam: DdayRow) => new Set(subjectsForExam(exam.exam_kind, allSubjects ?? []).map((s) => s.id));
    return new Map(candidates.map((t) => [t.id, examsForSubject(t.subject_id, date, ddays ?? [], examSubjects ?? [], fallback)]));
  }, [candidates, date, ddays, examSubjects, allSubjects]);
  const exams = useMemo(() => {
    const seen = new Map<string, DdayRow>();
    for (const list of examsByTask.values()) for (const e of list) seen.set(e.id, e);
    return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [examsByTask]);

  const [examId, setExamId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const exam = exams.find((e) => e.id === examId) ?? exams[0] ?? null;
  const fits = (task: TaskRow) => Boolean(exam && examsByTask.get(task.id)?.some((e) => e.id === exam.id));
  const chosen = candidates.filter((t) => picked.has(t.id) && fits(t));

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const save = async () => {
    if (!exam || chosen.length === 0) return;
    const base = (items ?? []).filter((i) => i.dday_id === exam.id && i.study_date === date && !i.deleted_at).length;
    const rows = chosen.map((t, i) => ({
      id: newId(),
      dday_id: exam.id,
      subject_id: t.subject_id,
      study_date: date,
      content: t.title.slice(0, ROADMAP_CONTENT_MAX),
      round: null,
      done_at: t.done_at,
      sort_order: base + i,
    }));
    onClose();
    try {
      // 로드맵 칸이 먼저 저장돼야 할 일이 그 칸을 가리킬 수 있다
      await roadmap.insert.mutateAsync({ rows, appendTo: roadmapKey });
    } catch {
      return; // 저장 실패 안내는 insert 가 띄운다
    }
    chosen.forEach((t, i) => tasks.update.mutate({ ids: [t.id], patch: { roadmap_item_id: rows[i].id } }));
    toast.show({ message: `${exam.title} 로드맵에 ${chosen.length}개를 올렸어요` });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`할 일을 로드맵에 올리기 · ${formatMonthDayWeekday(date)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={chosen.length === 0} onClick={() => void save()}>
            {chosen.length ? `${chosen.length}개 올리기` : "올리기"}
          </Button>
        </>
      }
    >
      {exams.length === 0 ? (
        <EmptyState
          message={
            candidates.length === 0
              ? "올릴 할 일이 없어요. 과목을 정한 할 일만 올릴 수 있고, 이미 로드맵과 이어진 할 일은 빠져요."
              : "이 할 일 과목이 들어간 다가오는 시험이 없어요. 스케줄 화면에서 시험과 과목을 먼저 넣어 주세요."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <SelectField
            label="올릴 시험"
            value={exam?.id ?? ""}
            onChange={setExamId}
            options={exams.map((e) => ({ value: e.id, label: `${e.title} (${formatMonthDayWeekday(e.date)})` }))}
          />
          <section aria-label="올릴 할 일">
            <h3 className="mb-1 text-12 text-sub">로드맵 달력 {formatMonthDayWeekday(date)} 칸에 올라가요. 체크는 서로 따라가요.</h3>
            <div className="flex flex-col">
              {candidates.map((t) => {
                const s = subjects.get(t.subject_id);
                const ok = fits(t);
                return (
                  <label key={t.id} className="flex min-h-11 items-center gap-2 border-b border-line py-1 last:border-b-0">
                    <Checkbox
                      checked={ok && picked.has(t.id)}
                      disabled={!ok}
                      onChange={(v) => toggle(t.id, v)}
                      label={`${t.title} 고르기`}
                    />
                    {s ? <SubjectTag name={s.name} color={s.color_key} /> : null}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-13 ${ok ? "text-ink" : "text-sub"}`}>{t.title}</span>
                      {!ok ? <span className="block text-11 text-sub">이 시험 과목이 아니에요</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}
