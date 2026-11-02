"use client";

import Link from "next/link";
import { SubjectProgressList } from "@/components/exam/subject-progress";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { useDdays, useExamSubjects, useRoadmapItems } from "@/lib/data/ddays";
import { useSubjectMap } from "@/lib/data/subjects";
import { useToday } from "@/lib/data/today";
import { ddayLabel } from "@/lib/dday/dday";
import { examProgress, subjectProgress } from "@/lib/exam/roadmap";

/**
 * 6.4 진행표: 진행 중인(아직 끝나지 않은) 시험마다 시험 대비 로드맵의 과목별 진행.
 * 끝낸 칸 ÷ 전체 칸, 오늘까지 계획 실현률, 회독별 진행을 보여 준다.
 */
export function ProgressBoard() {
  const today = useToday();
  const { data: ddays } = useDdays();
  const { data: items } = useRoadmapItems();
  const { data: examSubjects } = useExamSubjects();
  const subjects = useSubjectMap();
  const exams = (ddays ?? []).filter((d) => d.type === "exam" && d.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  if (exams.length === 0) {
    return (
      <div className="card">
        <EmptyState message="진행 중인 시험이 없어요. 시험 대비 화면에서 시험을 추가해 주세요." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {exams.map((exam) => {
        const list = (items ?? []).filter((i) => i.dday_id === exam.id);
        const ids = [
          ...new Set([
            ...(examSubjects ?? []).filter((e) => e.dday_id === exam.id).sort((a, b) => a.sort_order - b.sort_order).map((e) => e.subject_id),
            ...list.map((i) => i.subject_id),
          ]),
        ];
        const overall = examProgress(list);
        return (
          <section key={exam.id} className="card flex flex-col gap-4" aria-label={`${exam.title} 진행표`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-14 font-semibold">
                {exam.title} <span className="num ml-1 text-12 font-normal text-sub">{ddayLabel(exam.date, today)}</span>
              </h2>
              <Link href={`/exam/?id=${exam.id}`} className="text-12 text-accent">
                로드맵 보기
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <ProgressBar value={overall ?? 0} label={`${exam.title} 전체 진행률`} />
              <span className="num w-10 shrink-0 text-right text-12 text-sub">{Math.round((overall ?? 0) * 100)}%</span>
            </div>
            {ids.length === 0 ? (
              <p className="text-13 text-sub">아직 로드맵 계획이 없어요.</p>
            ) : (
              <SubjectProgressList rows={subjectProgress(list, ids, today)} subjects={subjects} />
            )}
          </section>
        );
      })}
    </div>
  );
}
