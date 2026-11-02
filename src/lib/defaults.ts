/**
 * 처음 로그인할 때 넣는 기본값 (supabase/telos.sql 의 bootstrap_user 와 같은 내용).
 * 가짜 백엔드(개발·E2E)와 테스트가 쓴다. SQL 을 바꾸면 여기도 함께 바꾼다.
 */
import type { SubjectColorKey } from "@/lib/design/subject-colors";
import type { SlotCategory, TimetableDefault } from "@/lib/supabase/database.types";

/** 모의고사 과목 (고정). 빠진 것이 있으면 bootstrap_user 가 다시 채운다 */
export type DefaultSubject = { name: string; color_key: SubjectColorKey };

export const MOCK_SUBJECTS: readonly DefaultSubject[] = [
  { name: "국어", color_key: "rose" },
  { name: "수학", color_key: "periwinkle" },
  { name: "영어", color_key: "mint" },
  { name: "한국사", color_key: "peach" },
  { name: "통합사회", color_key: "lavender" },
  { name: "통합과학", color_key: "butter" },
];

/** 시계 시각(자정부터 센 분)으로 적은 시간표 항목 */
export type DefaultSlot = { name: string; category: SlotCategory; start: number; end: number };

const hm = (h: number, m: number) => h * 60 + m;

export const DEFAULT_TIMETABLES: readonly { name: string; default_for: TimetableDefault; slots: readonly DefaultSlot[] }[] = [
  {
    name: "평일",
    default_for: "weekday",
    slots: [
      { name: "기상", category: "life", start: hm(6, 30), end: hm(6, 40) },
      { name: "아침 자습", category: "study", start: hm(7, 30), end: hm(8, 30) },
      { name: "1교시", category: "class", start: hm(8, 30), end: hm(9, 20) },
      { name: "2교시", category: "class", start: hm(9, 30), end: hm(10, 20) },
      { name: "3교시", category: "class", start: hm(10, 30), end: hm(11, 20) },
      { name: "4교시", category: "class", start: hm(11, 30), end: hm(12, 20) },
      { name: "점심 식사", category: "meal", start: hm(12, 20), end: hm(13, 30) },
      { name: "5교시", category: "class", start: hm(13, 30), end: hm(14, 20) },
      { name: "6교시", category: "class", start: hm(14, 30), end: hm(15, 20) },
      { name: "7교시", category: "class", start: hm(15, 30), end: hm(16, 20) },
      { name: "청소", category: "life", start: hm(16, 20), end: hm(16, 40) },
      { name: "8교시", category: "class", start: hm(16, 40), end: hm(17, 30) },
      { name: "9교시", category: "class", start: hm(17, 40), end: hm(18, 30) },
      { name: "저녁 식사", category: "meal", start: hm(18, 30), end: hm(19, 40) },
      { name: "야자 1차시", category: "study", start: hm(19, 40), end: hm(21, 0) },
      { name: "야자 2차시", category: "study", start: hm(21, 0), end: hm(22, 20) },
      { name: "야자 3차시", category: "study", start: hm(22, 20), end: hm(23, 0) },
      { name: "귀사", category: "life", start: hm(23, 0), end: hm(23, 10) },
      { name: "점호", category: "life", start: hm(23, 30), end: hm(23, 40) },
      { name: "기숙사 1차시", category: "study", start: hm(0, 0), end: hm(1, 0) },
      { name: "기숙사 2차시", category: "study", start: hm(1, 0), end: hm(2, 0) },
    ],
  },
  {
    name: "주말·공휴일",
    default_for: "weekend",
    slots: [
      { name: "기상", category: "life", start: hm(7, 0), end: hm(7, 10) },
      { name: "자습 1차시", category: "study", start: hm(8, 40), end: hm(10, 30) },
      { name: "자습 2차시", category: "study", start: hm(10, 30), end: hm(12, 10) },
      { name: "점심 식사", category: "meal", start: hm(12, 10), end: hm(13, 20) },
      { name: "자습 3차시", category: "study", start: hm(13, 20), end: hm(15, 0) },
      { name: "자습 4차시", category: "study", start: hm(15, 0), end: hm(16, 40) },
      { name: "자습 5차시", category: "study", start: hm(17, 0), end: hm(18, 0) },
      { name: "저녁 식사", category: "meal", start: hm(18, 0), end: hm(19, 0) },
      { name: "자습 6차시", category: "study", start: hm(19, 0), end: hm(20, 0) },
      { name: "자습 7차시", category: "study", start: hm(20, 0), end: hm(21, 0) },
      { name: "자습 8차시", category: "study", start: hm(21, 0), end: hm(22, 0) },
      { name: "자습 9차시", category: "study", start: hm(22, 0), end: hm(23, 0) },
      { name: "점호", category: "life", start: hm(22, 30), end: hm(22, 40) },
      { name: "자습 10차시", category: "study", start: hm(23, 0), end: hm(24, 0) },
      { name: "자습 11차시", category: "study", start: hm(0, 0), end: hm(1, 0) },
      { name: "자습 12차시", category: "study", start: hm(1, 0), end: hm(2, 0) },
    ],
  },
];

/** 2026~2028 공휴일 (대체공휴일, 선거일 포함). 사용자가 설정 > 공휴일에서 확인하고 고친다. */
export const DEFAULT_HOLIDAYS: readonly (readonly [string, string])[] = [
  ["2026-01-01", "신정"], ["2026-02-16", "설날 연휴"], ["2026-02-17", "설날"], ["2026-02-18", "설날 연휴"],
  ["2026-03-01", "삼일절"], ["2026-03-02", "대체공휴일"], ["2026-05-01", "노동절"], ["2026-05-05", "어린이날"],
  ["2026-05-24", "부처님오신날"], ["2026-05-25", "대체공휴일"], ["2026-06-03", "전국동시지방선거"],
  ["2026-06-06", "현충일"], ["2026-07-17", "제헌절"], ["2026-08-15", "광복절"], ["2026-08-17", "대체공휴일"],
  ["2026-09-24", "추석 연휴"], ["2026-09-25", "추석"], ["2026-09-26", "추석 연휴"],
  ["2026-10-03", "개천절"], ["2026-10-05", "대체공휴일"], ["2026-10-09", "한글날"], ["2026-12-25", "성탄절"],
  ["2027-01-01", "신정"], ["2027-02-06", "설날 연휴"], ["2027-02-07", "설날"], ["2027-02-08", "설날 연휴"],
  ["2027-02-09", "대체공휴일"], ["2027-03-01", "삼일절"], ["2027-05-01", "노동절"], ["2027-05-03", "대체공휴일"],
  ["2027-05-05", "어린이날"], ["2027-05-13", "부처님오신날"], ["2027-06-06", "현충일"],
  ["2027-07-17", "제헌절"], ["2027-07-19", "대체공휴일"], ["2027-08-15", "광복절"], ["2027-08-16", "대체공휴일"],
  ["2027-09-14", "추석 연휴"], ["2027-09-15", "추석"], ["2027-09-16", "추석 연휴"],
  ["2027-10-03", "개천절"], ["2027-10-04", "대체공휴일"], ["2027-10-09", "한글날"], ["2027-10-11", "대체공휴일"],
  ["2027-12-25", "성탄절"], ["2027-12-27", "대체공휴일"],
  ["2028-01-01", "신정"], ["2028-01-26", "설날 연휴"], ["2028-01-27", "설날"], ["2028-01-28", "설날 연휴"],
  ["2028-03-01", "삼일절"], ["2028-04-12", "국회의원선거"], ["2028-05-01", "노동절"],
  ["2028-05-02", "부처님오신날"], ["2028-05-05", "어린이날"], ["2028-06-06", "현충일"],
  ["2028-07-17", "제헌절"], ["2028-08-15", "광복절"], ["2028-10-02", "추석 연휴"], ["2028-10-03", "추석·개천절"],
  ["2028-10-04", "추석 연휴"], ["2028-10-05", "대체공휴일"], ["2028-10-09", "한글날"], ["2028-12-25", "성탄절"],
];
