import { addDays, isoWeekday } from "@/lib/date/days";
import type { DdayRow, ExamSubjectRow, RoadmapItemRow } from "@/lib/supabase/database.types";

/**
 * 시험 대비 로드맵 (6장)
 * 시험 하나가 카테고리이고, 달력의 날짜마다 "과목 + 무슨 공부"(로드맵 칸)를 적는다.
 * 진행표와 회독은 로드맵 칸에서 계산한다.
 */

type Item = Pick<RoadmapItemRow, "subject_id" | "study_date" | "done_at" | "round" | "deleted_at">;

export type CalendarCell = { date: string; inMonth: boolean };

/** 달력 한 달 (월요일 시작). month = "2026-11" */
export function monthMatrix(month: string): CalendarCell[][] {
  const first = `${month}-01`;
  const start = addDays(first, 1 - isoWeekday(first));
  const weeks: CalendarCell[][] = [];
  for (let d = start; ; ) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push({ date: d, inMonth: d.startsWith(month) });
      d = addDays(d, 1);
    }
    weeks.push(week);
    if (!d.startsWith(month)) break;
  }
  return weeks;
}

/** "2026-11" → 다음 달 / 이전 달 */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export type RoundCount = { round: number; total: number; done: number };

export type SubjectProgress = {
  subjectId: string;
  total: number;
  done: number;
  /** 오늘까지 계획한 칸 / 그중 끝낸 칸 (계획 실현률) */
  dueTotal: number;
  dueDone: number;
  /** 0~1, 칸이 없으면 null */
  rate: number | null;
  /** 오늘까지 계획 실현률 0~1, 오늘까지 계획이 없으면 null */
  dueRate: number | null;
  rounds: RoundCount[];
};

function live<T extends Pick<RoadmapItemRow, "deleted_at">>(items: readonly T[]): T[] {
  return items.filter((i) => !i.deleted_at);
}

/** 과목별 진행 (과목 순서는 subjectIds 순서) */
export function subjectProgress(items: readonly Item[], subjectIds: readonly string[], today: string): SubjectProgress[] {
  const list = live(items);
  return subjectIds.map((subjectId) => {
    const mine = list.filter((i) => i.subject_id === subjectId);
    const done = mine.filter((i) => i.done_at).length;
    const due = mine.filter((i) => i.study_date <= today);
    const dueDone = due.filter((i) => i.done_at).length;
    const roundMap = new Map<number, RoundCount>();
    for (const i of mine) {
      if (i.round == null) continue;
      const r = roundMap.get(i.round) ?? { round: i.round, total: 0, done: 0 };
      r.total += 1;
      if (i.done_at) r.done += 1;
      roundMap.set(i.round, r);
    }
    return {
      subjectId,
      total: mine.length,
      done,
      dueTotal: due.length,
      dueDone,
      rate: mine.length ? done / mine.length : null,
      dueRate: due.length ? dueDone / due.length : null,
      rounds: [...roundMap.values()].sort((a, b) => a.round - b.round),
    };
  });
}

/** 시험 전체 진행률 (끝낸 칸 ÷ 전체 칸, 칸이 없으면 null) */
export function examProgress(items: readonly Item[]): number | null {
  const list = live(items);
  if (list.length === 0) return null;
  return list.filter((i) => i.done_at).length / list.length;
}

/** 시험별 진행률 */
export function examProgressMap(items: readonly (Item & Pick<RoadmapItemRow, "dday_id">)[]): Map<string, number | null> {
  const byExam = new Map<string, (Item & Pick<RoadmapItemRow, "dday_id">)[]>();
  for (const it of live(items)) byExam.set(it.dday_id, [...(byExam.get(it.dday_id) ?? []), it]);
  return new Map([...byExam.entries()].map(([id, list]) => [id, examProgress(list)]));
}

/** 과목별 시험 날짜 (없으면 시험 첫날) */
export function subjectExamDate(
  dday: Pick<DdayRow, "id" | "date">,
  subjectId: string,
  examSubjects: readonly Pick<ExamSubjectRow, "dday_id" | "subject_id" | "exam_date" | "deleted_at">[],
): string {
  return (
    examSubjects.find((e) => e.dday_id === dday.id && e.subject_id === subjectId && !e.deleted_at)?.exam_date ?? dday.date
  );
}

/** 날짜별 칸 묶음 */
export function itemsByDate<T extends Pick<RoadmapItemRow, "study_date" | "deleted_at" | "sort_order">>(items: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of live(items)) out.set(it.study_date, [...(out.get(it.study_date) ?? []), it]);
  for (const list of out.values()) list.sort((a, b) => a.sort_order - b.sort_order);
  return out;
}

/**
 * 오늘 할 일로 가져올 수 있는 로드맵 칸: 아직 할 일로 넣지 않았고 끝내지 않은 칸 중
 * 오늘 계획(today) → 밀린 계획(overdue, 오래된 것부터) → 다가오는 계획(upcoming, days 일 안).
 */
export function roadmapCandidates<T extends Pick<RoadmapItemRow, "id" | "study_date" | "done_at" | "deleted_at" | "sort_order">>(
  items: readonly T[],
  linkedIds: ReadonlySet<string>,
  today: string,
  days = 7,
): { today: T[]; overdue: T[]; upcoming: T[] } {
  const open = live(items).filter((i) => !i.done_at && !linkedIds.has(i.id));
  const order = (a: T, b: T) => a.study_date.localeCompare(b.study_date) || a.sort_order - b.sort_order;
  const until = addDays(today, days);
  return {
    today: open.filter((i) => i.study_date === today).sort(order),
    overdue: open.filter((i) => i.study_date < today).sort(order),
    upcoming: open.filter((i) => i.study_date > today && i.study_date <= until).sort(order),
  };
}

/** "1회독" (없으면 빈 문자열) */
export function roundLabel(round: number | null): string {
  return round == null ? "" : `${round}회독`;
}

/**
 * 할 일을 올릴 수 있는 시험: 할 일 날짜 당일이나 그 뒤에 있는 시험 중 그 과목이 들어간 시험 (가까운 시험 먼저).
 * 시험 과목을 아직 하나도 넣지 않은 시험은 시험 종류에 맞는 과목(fallback)이면 된다.
 */
export function examsForSubject<E extends Pick<DdayRow, "id" | "type" | "date" | "deleted_at">>(
  subjectId: string,
  date: string,
  exams: readonly E[],
  examSubjects: readonly Pick<ExamSubjectRow, "dday_id" | "subject_id" | "deleted_at">[],
  fallback: (exam: E) => ReadonlySet<string>,
): E[] {
  return exams
    .filter((e) => e.type === "exam" && !e.deleted_at && e.date >= date)
    .filter((e) => {
      const ids = examSubjects.filter((x) => x.dday_id === e.id && !x.deleted_at).map((x) => x.subject_id);
      return ids.length > 0 ? ids.includes(subjectId) : fallback(e).has(subjectId);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
