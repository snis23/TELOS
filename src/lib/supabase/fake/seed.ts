/**
 * 개발 데모용 샘플 데이터 (npm run dev:demo). 배포 환경에서는 실행되지 않는다.
 * 처음 한 번만 넣는다. 날짜는 오늘을 기준으로 잡는다.
 */
import { addDays } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import type { FakeStore, Row } from "./store";

const SEEDED_KEY = "telos:fake-seeded:demo";

export function seedDemo(store: FakeStore, putFile: (path: string, blob: Blob) => void) {
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
  // 오답노트: 사진은 간단한 그림으로 만든다
  const svg = (label: string) =>
    new Blob(
      [`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#fbfaf7"/><text x="40" y="120" font-size="48" fill="#2a2b30">${label}</text><text x="40" y="220" font-size="32" fill="#6e7079">풀이 과정 사진</text></svg>`],
      { type: "image/svg+xml" },
    );
  const units = new Map(store.visible("units").map((u) => [u.name as string, u.id as string]));
  const [round] = add("mock_rounds", [{ year: 2026, month: 10, name: "2026년 10월 모의고사" }]);
  const notes = add("wrong_notes", [
    { kind: "school", subject_id: sid("수학"), unit_id: units.get("지수"), source: "문제집 p.91 12번", reason: "concept", memo: "지수법칙 다시 보기" },
    { kind: "school", subject_id: sid("수학"), unit_id: units.get("로그"), source: "교과서 p.140 5번", reason: "slip", solved_at: new Date().toISOString() },
    { kind: "mock", subject_id: sid("수학"), mock_round_id: round.id, question_no: 21, points: 4, reason: "time" },
    { kind: "school", subject_id: sid("국어"), unit_id: units.get("현대시"), source: "프린트 3번", reason: "concept" },
  ]);
  notes.forEach((n, i) => {
    const path = `${store.userId}/${n.id}/p${i}.jpg`;
    putFile(path, svg(`오답 ${i + 1}`));
    add("wrong_note_photos", [{ note_id: n.id, storage_path: path, sort_order: 0, width: 800, height: 600 }]);
  });

  // 암기 카드
  const [deck] = add("flash_decks", [{ title: "수능 영단어 Day 1", subject_id: sid("영어") }]);
  add("flash_cards", [
    { deck_id: deck.id, front: "abandon", back: "버리다", sort_order: 0 },
    { deck_id: deck.id, front: "benefit", back: "이익, 혜택", sort_order: 1, known: true },
    { deck_id: deck.id, front: "consequence", back: "결과", sort_order: 2 },
  ]);

  // 성적
  const grade = (y: number, sem: number, name: string, credits: number, raw: number, rank: number, total: number, g: number) => ({
    year: y, semester: sem, subject_id: sid(name), credits, raw_score: raw, rank, total_students: total, tie_count: 1, grade: g,
  });
  add("school_grades", [
    grade(1, 1, "국어", 4, 91, 18, 250, 1), grade(1, 1, "수학", 4, 84, 60, 250, 2), grade(1, 1, "영어", 4, 88, 40, 250, 2), grade(1, 1, "과학", 3, 79, 110, 250, 3),
    grade(1, 2, "국어", 4, 93, 12, 248, 1), grade(1, 2, "수학", 4, 88, 45, 248, 2), grade(1, 2, "영어", 4, 90, 30, 248, 2), grade(1, 2, "과학", 3, 85, 70, 248, 3),
    grade(2, 1, "국어", 4, 90, 20, 240, 1), grade(2, 1, "수학", 4, 92, 22, 240, 1), grade(2, 1, "영어", 3, 87, 50, 240, 2),
  ]);
  const [r6] = add("mock_rounds", [{ year: 2026, month: 6, name: "2026년 6월 모의고사" }]);
  const [r9] = add("mock_rounds", [{ year: 2026, month: 9, name: "2026년 9월 모의고사" }]);
  const ms = (roundId: unknown, name: string, raw: number, pct: number | null, g: number) => ({ mock_round_id: roundId, subject_id: sid(name), raw_score: raw, percentile: pct, grade: g });
  add("mock_scores", [
    ms(r6.id, "국어", 84, 91, 2), ms(r6.id, "수학", 76, 85, 3), ms(r6.id, "영어", 88, null, 2), ms(r6.id, "한국사", 42, null, 2),
    ms(r9.id, "국어", 88, 94, 2), ms(r9.id, "수학", 84, 92, 2), ms(r9.id, "영어", 92, null, 1), ms(r9.id, "한국사", 45, null, 1),
    ms(round.id, "국어", 91, 96, 1), ms(round.id, "수학", 80, 89, 2), ms(round.id, "영어", 90, null, 1), ms(round.id, "한국사", 47, null, 1),
  ]);
  add("targets", [{ subject_id: sid("수학"), school_target: 1, mock_target: 1 }]);
  add("records", [
    { kind: "seteuk", subject_id: sid("수학"), title: "지수함수와 인구 모델 탐구", date: addDays(today, -20), content: "로지스틱 모델과 비교해 보고서를 썼다." },
    { kind: "reading", subject_id: sid("국어"), title: "『사피엔스』 독서", date: addDays(today, -40), content: "인지 혁명 부분 요약" },
  ]);

  add("reflections", [
    { study_date: addDays(today, -1), condition: 4, good: "수학 문제집 목표량을 끝냈다", bad: "영어 단어를 미뤘다", tomorrow: "영단어 먼저 하기" },
  ]);
}
