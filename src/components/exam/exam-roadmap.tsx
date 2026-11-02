"use client";

import { useMemo, useState } from "react";
import { DdayDialog } from "@/components/dday/dday-dialog";
import { ddayPatch } from "@/components/dday/dday-editor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useDdayMutations, useExamSubjects, useRoadmapItems } from "@/lib/data/ddays";
import { useAllRows } from "@/lib/data/queries";
import { useAllSubjects, useSubjectMap } from "@/lib/data/subjects";
import { examProgress, itemsByDate, shiftMonth, subjectProgress } from "@/lib/exam/roadmap";
import { subjectsForExam } from "@/lib/subjects/subjects";
import type { DdayRow, ExamSubjectRow } from "@/lib/supabase/database.types";
import { DayDialog } from "./day-dialog";
import { ExamHero } from "./exam-hero";
import { ExamSubjectDialog, ExamSubjectMeta, ExamSubjectPicker } from "./exam-subjects";
import { RoadmapCalendar } from "./roadmap-calendar";
import { SubjectProgressList } from "./subject-progress";

/**
 * 시험 대비 카테고리 하나 (6장):
 * 위 큰 카드 → 과목별 진행(진행표·회독·시험 날짜·범위) → 큰 달력(날짜마다 과목 + 무슨 공부).
 */
export function ExamRoadmap({ exam, today }: { exam: DdayRow; today: string }) {
  const { data: allItems } = useRoadmapItems();
  const { data: allExamSubjects } = useExamSubjects();
  const { data: allTasks } = useAllRows("tasks", { orderBy: "study_date" });
  const { data: allSubjects } = useAllSubjects();
  const subjectMap = useSubjectMap();
  const { update, trash } = useDdayMutations();
  const [month, setMonth] = useState(() => (today <= exam.date ? today : exam.date).slice(0, 7));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<ExamSubjectRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(false);

  const items = useMemo(() => (allItems ?? []).filter((i) => i.dday_id === exam.id), [allItems, exam.id]);
  const examSubjects = useMemo(
    () => (allExamSubjects ?? []).filter((e) => e.dday_id === exam.id).sort((a, b) => a.sort_order - b.sort_order),
    [allExamSubjects, exam.id],
  );
  const subjects = examSubjects.map((e) => subjectMap.get(e.subject_id)).filter((s) => s !== undefined);
  const byDate = useMemo(() => itemsByDate(items), [items]);
  const linkedIds = useMemo(
    () => new Set((allTasks ?? []).map((t) => t.roadmap_item_id).filter((x): x is string => Boolean(x))),
    [allTasks],
  );
  const examDays = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const e of examSubjects) {
      const name = subjectMap.get(e.subject_id)?.name;
      if (!name) continue;
      const d = e.exam_date ?? exam.date;
      out.set(d, [...(out.get(d) ?? []), name]);
    }
    if (examSubjects.length === 0) out.set(exam.date, ["시험"]);
    return out;
  }, [examSubjects, subjectMap, exam.date]);

  // 시험 과목에서 뺐지만 칸이 남은 과목도 진행표에 보인다
  const progressIds = [...new Set([...examSubjects.map((e) => e.subject_id), ...items.map((i) => i.subject_id)])];
  const progress = subjectProgress(items, progressIds, today);
  const rowBySubject = new Map(examSubjects.map((e) => [e.subject_id, e]));
  const candidates = subjectsForExam(exam.exam_kind, allSubjects ?? []);

  return (
    <div className="flex flex-col gap-6">
      <ExamHero exam={exam} today={today} progress={examProgress(items)} onEdit={() => setEditingExam(true)} />

      <section aria-label="과목별 진행" className="card flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-14 font-semibold">과목별 진행 · 범위</h2>
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            과목 넣고 빼기
          </Button>
        </div>
        {progressIds.length === 0 ? (
          <EmptyState message="시험 과목이 없어요. 과목을 넣어 주세요." />
        ) : (
          <SubjectProgressList
            rows={progress}
            subjects={subjectMap}
            extra={(id) => {
              const row = rowBySubject.get(id);
              return row ? (
                <ExamSubjectMeta exam={exam} row={row} name={subjectMap.get(id)?.name ?? ""} onEdit={() => setEditingSubject(row)} />
              ) : null;
            }}
          />
        )}
      </section>

      <section aria-label="로드맵" className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-14 font-semibold">로드맵</h2>
          <p className="text-12 text-sub">날짜를 눌러 그날 공부할 과목과 내용을 적어요</p>
        </div>
        <RoadmapCalendar
          month={month}
          onMonthChange={(d) => setMonth((m) => shiftMonth(m, d))}
          today={today}
          itemsByDate={byDate}
          subjects={subjectMap}
          examDays={examDays}
          onOpenDay={setOpenDay}
        />
      </section>

      <DayDialog
        date={openDay}
        examId={exam.id}
        items={openDay ? (byDate.get(openDay) ?? []) : []}
        subjects={subjects.length ? subjects : candidates}
        subjectMap={subjectMap}
        linkedIds={linkedIds}
        onClose={() => setOpenDay(null)}
      />
      <ExamSubjectDialog
        exam={exam}
        row={editingSubject}
        subject={editingSubject ? subjectMap.get(editingSubject.subject_id) : undefined}
        onClose={() => setEditingSubject(null)}
      />
      <ExamSubjectPicker open={pickerOpen} exam={exam} rows={examSubjects} candidates={candidates} onClose={() => setPickerOpen(false)} />
      <DdayDialog
        open={editingExam}
        dday={exam}
        onClose={() => setEditingExam(false)}
        onSubmit={(v) => update.mutate({ ids: [exam.id], patch: ddayPatch(v) })}
        onDelete={() => {
          trash.mutate({ id: exam.id });
          setEditingExam(false);
        }}
      />
    </div>
  );
}
