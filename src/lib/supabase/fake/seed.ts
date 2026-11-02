/**
 * 개발 데모용 샘플 데이터 (npm run dev:demo). 배포 환경에서는 실행되지 않는다.
 * 처음 한 번만 넣는다. 날짜는 오늘을 기준으로 잡는다.
 */
import { addDays } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import type { FakeStore, Row } from "./store";

const SEEDED_KEY = "telos:fake-seeded:demo";

export function seedDemo(store: FakeStore) {
  try {
    if (window.localStorage.getItem(SEEDED_KEY)) return;
    window.localStorage.setItem(SEEDED_KEY, "1");
  } catch {
    return;
  }
  const today = getStudyDate(new Date());
  const subjects = new Map(store.visible("subjects").map((s) => [s.name as string, s.id as string]));
  const sid = (name: string) => subjects.get(name) ?? null;
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+09:00`).toISOString();
  const add = (table: Parameters<FakeStore["insert"]>[0], rows: Row[]) => store.insert(table, rows);

  // D-day
  const [finals] = add("ddays", [
    { type: "exam", title: "2학기 기말고사", date: addDays(today, 36), pinned: true, pin_order: 0, review_days: 3 },
  ]);
  add("ddays", [
    { type: "performance", title: "수학 탐구 보고서", date: addDays(today, 5), subject_id: sid("수학"), perf_kind: "report", status: "doing", prep_percent: 40 },
    { type: "exam", title: "11월 모의고사", date: addDays(today, 12) },
    { type: "etc", title: "동아리 발표", date: addDays(today, 20) },
  ]);

  // 범위 분배와 단원
  add("range_items", [
    { dday_id: finals.id, subject_id: sid("수학"), name: "문제집", unit_label: "page", start_no: 40, end_no: 160, done_amount: 43 },
    { dday_id: finals.id, subject_id: sid("수학"), name: "교과서", unit_label: "page", start_no: 120, end_no: 210, done_amount: 60 },
    { dday_id: finals.id, subject_id: sid("국어"), name: "프린트", unit_label: "unit", start_no: 1, end_no: 6, done_amount: 2 },
    { dday_id: finals.id, subject_id: sid("영어"), name: "교과서", unit_label: "chapter", start_no: 5, end_no: 8, done_amount: 1 },
  ]);
  add("units", [
    { subject_id: sid("수학"), name: "지수", sort_order: 0, status: "done" },
    { subject_id: sid("수학"), name: "로그", sort_order: 1, status: "doing" },
    { subject_id: sid("수학"), name: "삼각함수", sort_order: 2 },
    { subject_id: sid("국어"), name: "현대시", sort_order: 0, status: "done" },
    { subject_id: sid("국어"), name: "고전 소설", sort_order: 1 },
  ]);

  // 반복 할 일
  add("recurrences", [
    { subject_id: sid("영어"), title: "영단어 50개", est_minutes: 30, rule: { type: "daily" }, start_date: addDays(today, -10), default_slot_name: "야자 1차시" },
  ]);

  // 오늘 할 일 (미룬 단계 0~3)
  add("tasks", [
    { subject_id: sid("수학"), title: "문제집 p.84–97", est_minutes: 60, study_date: today, sort_order: 0 },
    { subject_id: sid("국어"), title: "현대시 복습", est_minutes: 40, study_date: today, sort_order: 1, deferred_count: 1 },
    { subject_id: sid("과학"), title: "화학 개념 정리", est_minutes: 50, study_date: today, sort_order: 2, deferred_count: 2 },
    { subject_id: sid("사회"), title: "사회 서술형 연습", est_minutes: 30, study_date: today, sort_order: 3, deferred_count: 3 },
    { subject_id: sid("한국사"), title: "근현대사 연표", est_minutes: 20, study_date: today, sort_order: 4, done_at: new Date().toISOString() },
  ]);

  // 최근 공부 기록 (오늘과 지난 6일)
  for (let i = 6; i >= 1; i -= 1) {
    const d = addDays(today, -i);
    add("timer_sessions", [
      { kind: "study", subject_id: sid("수학"), started_at: at(d, "19:40"), ended_at: at(d, i % 2 ? "21:00" : "20:30") },
      { kind: "study", subject_id: sid("영어"), started_at: at(d, "21:10"), ended_at: at(d, "22:00") },
      { kind: "nap", subject_id: null, started_at: at(d, "13:00"), ended_at: at(d, "13:15") },
    ]);
  }
  add("reflections", [
    { study_date: addDays(today, -1), condition: 4, good: "수학 문제집 목표량을 끝냈다", bad: "영어 단어를 미뤘다", tomorrow: "영단어 먼저 하기" },
  ]);
}
