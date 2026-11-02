"use client";

import Link from "next/link";
import { SubjectProgressList } from "@/components/exam/subject-progress";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { useDdays, useExamSubjects, useRoadmapItems } from "@/lib/data/ddays";
import { useSubjectMap } from "@/lib/data/subjects";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { ddayLabel } from "@/lib/dday/dday";
import { examProgress, subjectProgress } from "@/lib/exam/roadmap";

const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);

/** 시험 대비 기록: 시험마다 로드맵 진행, 계획 실현률, 과목별·회독별 진행. 끝난 시험도 남는다 */
export function ExamRecords({ today }: { today: string }) {
  const { data: ddays } = useDdays();
  const { data: items } = useRoadmapItems();
  const { data: examSubjects } = useExamSubjects();
  const subjects = useSubjectMap();
  const exams = (ddays ?? []).filter((d) => d.type === "exam").sort((a, b) => b.date.localeCompare(a.date));
  if (exams.length === 0) {
    return (
      <Card title="시험 대비 기록">
        <EmptyState message="아직 시험 대비 기록이 없어요" />
      </Card>
    );
  }
  return (
    <>
      {exams.map((exam) => {
        const list = (items ?? []).filter((i) => i.dday_id === exam.id);
        const ids = [
          ...new Set([
            ...(examSubjects ?? []).filter((e) => e.dday_id === exam.id).sort((a, b) => a.sort_order - b.sort_order).map((e) => e.subject_id),
            ...list.map((i) => i.subject_id),
          ]),
        ];
        const due = list.filter((i) => i.study_date <= today);
        const dueRate = due.length ? due.filter((i) => i.done_at).length / due.length : null;
        const overall = examProgress(list);
        const past = exam.date < today;
        return (
          <Card key={exam.id} title={exam.title}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-12 text-sub">
                <span>
                  {formatMonthDayWeekday(exam.date)} · {past ? "끝난 시험" : ddayLabel(exam.date, today)}
                </span>
                <span>로드맵 {list.filter((i) => i.done_at).length}/{list.length}칸</span>
                <span>계획 실현률 {pct(dueRate)}</span>
                <Link href={`/exam/?id=${exam.id}`} className="text-accent">
                  로드맵 보기
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <ProgressBar value={overall ?? 0} label={`${exam.title} 진행률`} />
                <span className="num w-10 shrink-0 text-right text-12 text-sub">{pct(overall)}</span>
              </div>
              {ids.length ? <SubjectProgressList rows={subjectProgress(list, ids, today)} subjects={subjects} /> : null}
            </div>
          </Card>
        );
      })}
    </>
  );
}
