import { MOCK_SUBJECTS } from "@/lib/defaults";
import type { ExamKind, ProfileRow, SubjectRow } from "@/lib/supabase/database.types";

/**
 * 과목 구조 (1차 수정)
 * - 모의고사 과목: 국어·수학·영어·한국사·통합과학·통합사회 (고정, 지우거나 보관하지 않는다)
 * - 내신 과목: 학기마다 바뀐다. 학기가 끝나면 보관하고, 보관한 과목의 기록은 그대로 남는다.
 */

export type Term = {
  /** 학년도 (3월에 시작하는 해) */
  schoolYear: number;
  semester: 1 | 2;
  /** 학년 (1~3). 입학 연도를 모르거나 범위를 벗어나면 null */
  grade: number | null;
  /** "2-1" (학년이 없으면 null) */
  key: string | null;
};

type SemesterDates = Pick<ProfileRow, "sem1_start" | "sem2_start">;

/**
 * 날짜("YYYY-MM-DD")가 속한 학기.
 * 1학기 시작일(기본 03-01) 전이면 지난 학년도 2학기, 2학기 시작일(기본 08-01)부터 2학기.
 * 여름 방학은 2학기 시작 전까지 1학기로 센다.
 */
export function termOf(date: string, dates: SemesterDates, entryYear: number | null): Term {
  const year = Number(date.slice(0, 4));
  const md = date.slice(5);
  const schoolYear = md >= dates.sem1_start ? year : year - 1;
  const semester: 1 | 2 = md >= dates.sem1_start && md < dates.sem2_start ? 1 : 2;
  const g = entryYear == null ? null : schoolYear - entryYear + 1;
  const grade = g != null && g >= 1 && g <= 3 ? g : null;
  return { schoolYear, semester, grade, key: grade == null ? null : `${grade}-${semester}` };
}

/** "2-1" → "2학년 1학기" */
export function termLabel(key: string | null): string {
  if (!key) return "";
  const [g, s] = key.split("-");
  return `${g}학년 ${s}학기`;
}

/** 새 학기 정리 창을 띄울지: 학년을 알 수 있고, 이번 학기를 아직 정리하지 않았으면 */
export function needsTermReview(term: Term, reviewedTerm: string | null): boolean {
  return term.key != null && term.key !== reviewedTerm;
}

const isLive = (s: Pick<SubjectRow, "deleted_at">) => !s.deleted_at;
const byOrder = (a: SubjectRow, b: SubjectRow) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

/** 모의고사 과목 (보관한 것 제외), 고정 순서 */
export function mockSubjects(all: readonly SubjectRow[]): SubjectRow[] {
  return all.filter((s) => isLive(s) && s.kind === "mock" && !s.archived_at).sort(byOrder);
}

/** 지금 배우는 내신 과목 (보관하지 않은 것) */
export function activeSchoolSubjects(all: readonly SubjectRow[]): SubjectRow[] {
  return all.filter((s) => isLive(s) && s.kind === "school" && !s.archived_at).sort(byOrder);
}

/** 보관한 과목 (최근에 보관한 것부터) */
export function archivedSubjects(all: readonly SubjectRow[]): SubjectRow[] {
  return all
    .filter((s) => isLive(s) && s.archived_at)
    .sort((a, b) => String(b.archived_at).localeCompare(String(a.archived_at)) || byOrder(a, b));
}

/** 고르는 목록에 쓰는 과목: 모의고사 과목 다음에 지금 내신 과목. 타이머 숫자 단축키(1~8)도 이 순서다 */
export function pickableSubjects(all: readonly SubjectRow[]): SubjectRow[] {
  return [...mockSubjects(all), ...activeSchoolSubjects(all)];
}

/** 시험 종류에 맞는 기본 과목 (내신: 지금 내신 과목, 모의고사: 모의고사 과목, 기타: 모두) */
export function subjectsForExam(kind: ExamKind | null, all: readonly SubjectRow[]): SubjectRow[] {
  if (kind === "school") return activeSchoolSubjects(all);
  if (kind === "mock") return mockSubjects(all);
  return pickableSubjects(all);
}

/** 오답노트 종류에 맞는 과목 (내신 오답 → 내신 과목, 모의고사 오답 → 모의고사 과목) */
export function subjectsForNotes(kind: "school" | "mock", all: readonly SubjectRow[]): SubjectRow[] {
  return kind === "school" ? activeSchoolSubjects(all) : mockSubjects(all);
}

export const MOCK_SUBJECT_NAMES: readonly string[] = MOCK_SUBJECTS.map((s) => s.name);

/** 과목 이름 옆 꼬리표: 보관한 내신 과목은 "1-2" 처럼 학기를 붙여 구분한다 */
export function subjectTag(s: Pick<SubjectRow, "kind" | "term" | "archived_at">): string | null {
  if (s.kind === "school" && s.archived_at && s.term) return s.term;
  return null;
}
