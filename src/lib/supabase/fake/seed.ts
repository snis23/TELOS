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
  const add = (table: Parameters<FakeStore["insert"]>[0], rows: Row[]) => store.insert(table, rows);

  // 입학 연도와 이번 학기 내신 과목 (모의고사 과목 6개는 bootstrap 이 넣는다)
  const year = Number(today.slice(0, 4)) - (today.slice(5) < "03-01" ? 1 : 0);
  const profile = store.visible("profiles")[0];
  const term = today.slice(5) >= "03-01" && today.slice(5) < "08-01" ? "2-1" : "2-2";
  if (profile) store.update("profiles", [profile], { entry_year: year - 1, reviewed_term: term });
  add("subjects", [
    { name: "문학", color_key: "sky", kind: "school", term, sort_order: 10 },
    { name: "대수", color_key: "sage", kind: "school", term, sort_order: 11 },
    { name: "영어Ⅰ", color_key: "mint", kind: "school", term, sort_order: 12 },
    { name: "화학Ⅰ", color_key: "butter", kind: "school", term, sort_order: 13 },
    { name: "통합과학1", color_key: "peach", kind: "school", term: "1-1", sort_order: 14, archived_at: new Date().toISOString() },
  ]);
  const subjects = new Map(
    store.visible("subjects").map((s) => [`${s.kind === "mock" ? "모의 " : ""}${s.name as string}`, s.id as string]),
  );
  const sid = (name: string) => subjects.get(name) ?? null;
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+09:00`).toISOString();
  const doneAt = new Date().toISOString();

  // 시험 대비 카테고리 두 개: 내신(기말고사), 모의고사
  const [finals] = add("ddays", [
    { type: "exam", exam_kind: "school", title: "2학기 기말고사", date: addDays(today, 36), pinned: true, pin_order: 0 },
  ]);
  const [mockExam] = add("ddays", [{ type: "exam", exam_kind: "mock", title: "11월 모의고사", date: addDays(today, 12) }]);
  add("ddays", [
    { type: "performance", title: "대수 탐구 보고서", date: addDays(today, 5), subject_id: sid("대수"), perf_kind: "report", status: "doing", prep_percent: 40 },
    { type: "etc", title: "동아리 발표", date: addDays(today, 20) },
  ]);
  add("exam_subjects", [
    { dday_id: finals.id, subject_id: sid("문학"), exam_date: addDays(today, 36), range_note: "교과서 p.120~210, 프린트 1~6", sort_order: 0 },
    { dday_id: finals.id, subject_id: sid("대수"), exam_date: addDays(today, 37), range_note: "문제집 p.40~160", sort_order: 1 },
    { dday_id: finals.id, subject_id: sid("영어Ⅰ"), exam_date: addDays(today, 38), range_note: "5~8과", sort_order: 2 },
    { dday_id: finals.id, subject_id: sid("화학Ⅰ"), exam_date: addDays(today, 38), sort_order: 3 },
    ...["국어", "수학", "영어", "한국사", "통합과학", "통합사회"].map((n, i) => ({ dday_id: mockExam.id, subject_id: sid(`모의 ${n}`), sort_order: i })),
  ]);
  add("roadmap_items", [
    { dday_id: finals.id, subject_id: sid("대수"), study_date: addDays(today, -2), content: "문제집 p.40~60", round: 1, done_at: doneAt },
    { dday_id: finals.id, subject_id: sid("대수"), study_date: addDays(today, -1), content: "문제집 p.61~80", round: 1 },
    { dday_id: finals.id, subject_id: sid("문학"), study_date: addDays(today, -1), content: "현대시 3편 정리", round: 1, done_at: doneAt },
    { dday_id: finals.id, subject_id: sid("대수"), study_date: today, content: "문제집 p.81~100", round: 1 },
    { dday_id: finals.id, subject_id: sid("화학Ⅰ"), study_date: today, content: "2단원 개념 정리", round: 1 },
    { dday_id: finals.id, subject_id: sid("영어Ⅰ"), study_date: addDays(today, 1), content: "5과 본문 암기" },
    { dday_id: finals.id, subject_id: sid("문학"), study_date: addDays(today, 2), content: "고전 소설 프린트", round: 1 },
    { dday_id: mockExam.id, subject_id: sid("모의 수학"), study_date: today, content: "기출 21번 유형", round: 2 },
    { dday_id: mockExam.id, subject_id: sid("모의 국어"), study_date: addDays(today, 1), content: "비문학 3지문" },
  ]);
  add("units", [
    { subject_id: sid("대수"), name: "지수", sort_order: 0 },
    { subject_id: sid("대수"), name: "로그", sort_order: 1 },
    { subject_id: sid("대수"), name: "삼각함수", sort_order: 2 },
    { subject_id: sid("문학"), name: "현대시", sort_order: 0 },
    { subject_id: sid("문학"), name: "고전 소설", sort_order: 1 },
  ]);

  // 반복 할 일
  add("recurrences", [
    { subject_id: sid("모의 영어"), title: "영단어 50개", est_minutes: 30, rule: { type: "daily" }, start_date: addDays(today, -10), default_slot_name: "야자 1차시" },
  ]);

  // 오늘 할 일 (미룬 단계 0~3)
  add("tasks", [
    { subject_id: sid("대수"), title: "문제집 p.84–97", est_minutes: 60, study_date: today, sort_order: 0 },
    { subject_id: sid("문학"), title: "현대시 복습", est_minutes: 40, study_date: today, sort_order: 1, deferred_count: 1 },
    { subject_id: sid("화학Ⅰ"), title: "화학 개념 정리", est_minutes: 50, study_date: today, sort_order: 2, deferred_count: 2 },
    { subject_id: sid("모의 통합사회"), title: "사회 서술형 연습", est_minutes: 30, study_date: today, sort_order: 3, deferred_count: 3 },
    { subject_id: sid("모의 한국사"), title: "근현대사 연표", est_minutes: 20, study_date: today, sort_order: 4, done_at: doneAt },
  ]);

  // 최근 공부 기록 (오늘과 지난 6일)
  for (let i = 6; i >= 1; i -= 1) {
    const d = addDays(today, -i);
    add("timer_sessions", [
      { kind: "study", subject_id: sid("대수"), started_at: at(d, "19:40"), ended_at: at(d, i % 2 ? "21:00" : "20:30") },
      { kind: "study", subject_id: sid("모의 영어"), started_at: at(d, "21:10"), ended_at: at(d, "22:00") },
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
    { kind: "school", subject_id: sid("대수"), unit_id: units.get("지수"), source: "문제집 p.91 12번", reason: "concept", memo: "지수법칙 다시 보기" },
    { kind: "school", subject_id: sid("대수"), unit_id: units.get("로그"), source: "교과서 p.140 5번", reason: "slip", solved_at: doneAt },
    { kind: "mock", subject_id: sid("모의 수학"), mock_round_id: round.id, question_no: 21, points: 4, reason: "time" },
    { kind: "school", subject_id: sid("문학"), unit_id: units.get("현대시"), source: "프린트 3번", reason: "concept" },
  ]);
  notes.forEach((n, i) => {
    const path = `${store.userId}/${n.id}/p${i}.jpg`;
    putFile(path, svg(`오답 ${i + 1}`));
    add("wrong_note_photos", [{ note_id: n.id, storage_path: path, sort_order: 0, width: 800, height: 600 }]);
  });

  // 암기 카드
  const [deck] = add("flash_decks", [{ title: "수능 영단어 Day 1", subject_id: sid("모의 영어") }]);
  add("flash_cards", [
    { deck_id: deck.id, front: "abandon", back: "버리다", sort_order: 0 },
    { deck_id: deck.id, front: "benefit", back: "이익, 혜택", sort_order: 1, known: true },
    { deck_id: deck.id, front: "consequence", back: "결과", sort_order: 2 },
  ]);

  add("reflections", [
    { study_date: addDays(today, -1), comment: "대수 문제집 목표량을 끝냈다. 영어 단어는 미뤘으니 내일 먼저 하기" },
  ]);
}
