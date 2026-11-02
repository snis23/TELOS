"use client";

import { TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubjectDot } from "@/components/ui/subject-dot";
import { useRoadmapItems } from "@/lib/data/ddays";
import { useNotes } from "@/lib/data/learn";
import { useAllRows } from "@/lib/data/queries";
import { useDailyStats, useDeferrals } from "@/lib/data/stats";
import { useSubjectMap, useSubjects } from "@/lib/data/subjects";
import { ICON_STROKE } from "@/lib/design/icons";
import { subjectInsights, weakSubjects } from "@/lib/stats/insights";
import { formatDurationKo } from "@/lib/timer/format";

const WINDOW_DAYS = 14;

/**
 * 개선이 필요한 과목 (8.1): 최근 14일(오늘 제외)의 로드맵 계획 실현률, 할 일 실행률,
 * 미룬 횟수, 공부 시간 비중, 쌓인 오답을 보고 저조한 과목과 개선점을 보여 준다.
 */
export function InsightsCard({ today }: { today: string }) {
  const { data: subjects } = useSubjects();
  const subjectMap = useSubjectMap();
  const { data: roadmap } = useRoadmapItems();
  const { data: tasks } = useAllRows("tasks", { orderBy: "study_date" });
  const { data: deferrals } = useDeferrals(today);
  const { data: stats } = useDailyStats(today, 30);
  const { data: notes } = useNotes();

  const all = subjectInsights({
    subjectIds: (subjects ?? []).map((s) => s.id),
    today,
    days: WINDOW_DAYS,
    roadmap: roadmap ?? [],
    tasks: tasks ?? [],
    deferrals: deferrals ?? [],
    stats: stats ?? [],
    notes: notes ?? [],
  });
  const weak = weakSubjects(all);

  return (
    <Card title={`개선이 필요한 과목 (최근 ${WINDOW_DAYS}일)`}>
      {weak.length === 0 ? (
        <EmptyState message="저조한 과목이 없어요. 지금처럼 계획대로 해 나가요" />
      ) : (
        <ul className="flex flex-col gap-4" aria-label="개선이 필요한 과목">
          {weak.map((w) => {
            const s = subjectMap.get(w.subjectId);
            if (!s) return null;
            return (
              <li key={w.subjectId} className="flex flex-col gap-1.5 rounded-input bg-surface-2 p-3" data-testid="weak-subject">
                <p className="flex items-center gap-2 text-14 font-medium text-ink">
                  <TrendingDown size={16} strokeWidth={ICON_STROKE} className="text-urgent-ink" aria-hidden />
                  <SubjectDot color={s.color_key} />
                  {s.name}
                  <span className="ml-auto text-11 font-normal text-sub">공부 {formatDurationKo(w.studySeconds)}</span>
                </p>
                <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-12 text-urgent-ink">
                  {w.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <ul className="flex flex-col gap-0.5 text-13 text-ink-2">
                  {w.tips.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
