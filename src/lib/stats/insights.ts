import { addDays } from "@/lib/date/days";
import type { DailyStatRow, RoadmapItemRow, TaskDeferralRow, TaskRow, WrongNoteRow } from "@/lib/supabase/database.types";

/**
 * 기록 화면의 "개선이 필요한 과목" (8.1).
 * 최근 기간(기본 14일, 오늘 제외)의 로드맵 계획 실현률, 할 일 실행률, 미룬 횟수, 공부 시간 비중,
 * 쌓인 오답으로 과목마다 점수를 매기고, 기준을 넘은 과목에 개선점을 붙인다.
 */

export type SubjectInsight = {
  subjectId: string;
  /** 클수록 시급하다 */
  score: number;
  roadmapDue: number;
  roadmapDone: number;
  tasksPlanned: number;
  tasksDone: number;
  deferrals: number;
  studySeconds: number;
  /** 전체 공부 시간 중 이 과목 비율 0~1 (전체가 0이면 null) */
  studyShare: number | null;
  unsolvedNotes: number;
  reasons: string[];
  tips: string[];
};

export type InsightInput = {
  subjectIds: readonly string[];
  today: string;
  days?: number;
  roadmap: readonly Pick<RoadmapItemRow, "subject_id" | "study_date" | "done_at" | "deleted_at">[];
  tasks: readonly Pick<TaskRow, "subject_id" | "study_date" | "done_at" | "deleted_at">[];
  deferrals: readonly Pick<TaskDeferralRow, "subject_id" | "from_date">[];
  stats: readonly Pick<DailyStatRow, "subject_id" | "study_date" | "study_seconds">[];
  notes: readonly Pick<WrongNoteRow, "subject_id" | "solved_at" | "deleted_at">[];
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const LOW_RATE = 0.6;

export function subjectInsights(input: InsightInput): SubjectInsight[] {
  const days = input.days ?? 14;
  const from = addDays(input.today, -days);
  const to = addDays(input.today, -1);
  const inWindow = (d: string) => d >= from && d <= to;

  const totalStudy = input.stats
    .filter((s) => s.subject_id && inWindow(s.study_date))
    .reduce((sum, s) => sum + s.study_seconds, 0);

  const out: SubjectInsight[] = input.subjectIds.map((subjectId) => {
    const road = input.roadmap.filter((r) => !r.deleted_at && r.subject_id === subjectId && inWindow(r.study_date));
    const roadDone = road.filter((r) => r.done_at).length;
    const tasks = input.tasks.filter((t) => !t.deleted_at && t.subject_id === subjectId && inWindow(t.study_date));
    const tasksDone = tasks.filter((t) => t.done_at).length;
    const deferrals = input.deferrals.filter((d) => d.subject_id === subjectId && inWindow(d.from_date)).length;
    const studySeconds = input.stats
      .filter((s) => s.subject_id === subjectId && inWindow(s.study_date))
      .reduce((sum, s) => sum + s.study_seconds, 0);
    const studyShare = totalStudy > 0 ? studySeconds / totalStudy : null;
    const unsolvedNotes = input.notes.filter((n) => !n.deleted_at && n.subject_id === subjectId && !n.solved_at).length;

    const reasons: string[] = [];
    const tips: string[] = [];
    let score = 0;
    if (road.length >= 2 && roadDone / road.length < LOW_RATE) {
      const rate = roadDone / road.length;
      reasons.push(`로드맵 계획 실현률 ${pct(rate)} (${road.length}개 중 ${roadDone}개)`);
      tips.push("하루 계획을 지금의 절반 정도로 줄이고, 그날 첫 자습 차시에 이 과목을 먼저 넣어 보세요.");
      score += (LOW_RATE - rate) * 10 + 2;
    }
    if (tasks.length >= 3 && tasksDone / tasks.length < LOW_RATE) {
      const rate = tasksDone / tasks.length;
      reasons.push(`할 일 실행률 ${pct(rate)} (${tasks.length}개 중 ${tasksDone}개)`);
      tips.push("할 일마다 시작 시각이나 차시를 정해 두면 끝낼 가능성이 높아져요.");
      score += (LOW_RATE - rate) * 6 + 1;
    }
    if (deferrals >= 3) {
      reasons.push(`최근 ${days}일 동안 ${deferrals}번 미룸`);
      tips.push("자주 미루는 할 일은 30분 안에 끝낼 크기로 쪼개 보세요.");
      score += Math.min(deferrals, 10) * 0.5;
    }
    if (studyShare != null && studyShare < 0.05 && (road.length > 0 || tasks.length > 0)) {
      reasons.push(`공부 시간 비중 ${pct(studyShare)}`);
      tips.push("계획은 있는데 공부 시간이 적어요. 타이머로 이 과목 시간을 따로 재 보세요.");
      score += 2;
    }
    if (unsolvedNotes >= 5) {
      reasons.push(`다시 풀 오답 ${unsolvedNotes}개`);
      tips.push("주말 자습 차시 하나를 이 과목 오답 다시 풀기에 써 보세요.");
      score += Math.min(unsolvedNotes, 20) * 0.15;
    }
    return {
      subjectId,
      score,
      roadmapDue: road.length,
      roadmapDone: roadDone,
      tasksPlanned: tasks.length,
      tasksDone,
      deferrals,
      studySeconds,
      studyShare,
      unsolvedNotes,
      reasons,
      tips,
    };
  });
  return out.sort((a, b) => b.score - a.score);
}

/** 개선이 필요한 과목만 (점수 순) */
export function weakSubjects(list: readonly SubjectInsight[]): SubjectInsight[] {
  return list.filter((s) => s.reasons.length > 0);
}
