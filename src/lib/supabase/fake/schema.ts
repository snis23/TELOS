/**
 * 가짜 백엔드용 스키마 정보 (supabase/telos.sql 을 흉내 낸다).
 * 개발 데모와 E2E 테스트에서만 쓴다. 배포 빌드에는 들어가지 않는다.
 */
import type { TableName } from "../database.types";

type Row = Record<string, unknown>;

/** 테이블별 기본값 (id, user_id, created_at, updated_at 은 공통으로 채운다) */
export const TABLE_DEFAULTS: Record<TableName, Row> = {
  profiles: {
    theme: "system",
    day_start_hour: 6,
    sem1_start: "03-01",
    sem1_end: "07-31",
    sem2_start: "08-01",
    sem2_end: "02-29",
    entry_year: null,
    reviewed_term: null,
    sidebar_collapsed: false,
    last_backup_at: null,
  },
  subjects: { sort_order: 0, kind: "school", term: null, archived_at: null },
  units: { sort_order: 0, status: "todo" },
  timetables: { default_for: "none", sort_order: 0 },
  timetable_slots: {},
  holidays: {},
  date_timetables: {},
  recurrences: { subject_id: null, est_minutes: null, end_date: null, default_slot_name: null, default_start_min: null },
  ddays: {
    subject_id: null,
    pinned: false,
    pin_order: 0,
    status: "todo",
    prep_percent: null,
    perf_kind: null,
    memo: null,
    exam_kind: null,
  },
  exam_subjects: { exam_date: null, range_note: null, sort_order: 0 },
  roadmap_items: { round: null, done_at: null, sort_order: 0 },
  tasks: {
    subject_id: null,
    est_minutes: null,
    sort_order: 0,
    done_at: null,
    deferred_count: 0,
    missed_streak: 0,
    must_do: false,
    start_min: null,
    end_min: null,
    slot_id: null,
    source: "manual",
    recurrence_id: null,
    roadmap_item_id: null,
  },
  task_deferrals: { task_id: null, subject_id: null },
  timer_sessions: { subject_id: null, ended_at: null, device_label: null },
  daily_stats: {
    subject_id: null,
    study_seconds: 0,
    nap_seconds: 0,
    nap_count: 0,
    planned_tasks: 0,
    done_tasks: 0,
    deferred_events: 0,
  },
  reflections: { comment: "" },
  mock_rounds: {},
  wrong_notes: {
    unit_id: null,
    mock_round_id: null,
    source: null,
    question_no: null,
    points: null,
    memo: null,
    solved_at: null,
  },
  wrong_note_photos: { sort_order: 0, width: null, height: null },
  flash_decks: { subject_id: null, sort_order: 0 },
  flash_cards: { known: false, sort_order: 0 },
  pending_file_deletions: {},
  maintenance_runs: {},
};

/** 휴지통 열이 있는 테이블 */
export const HAS_TRASH = new Set<TableName>([
  "subjects",
  "units",
  "timetables",
  "timetable_slots",
  "holidays",
  "date_timetables",
  "recurrences",
  "ddays",
  "exam_subjects",
  "roadmap_items",
  "tasks",
  "timer_sessions",
  "reflections",
  "mock_rounds",
  "wrong_notes",
  "wrong_note_photos",
  "flash_decks",
  "flash_cards",
]);

type Unique = { cols: string[]; when?: (row: Row) => boolean };
const active = (row: Row) => row.deleted_at == null;

/** 고유 제약 (같은 값이면 23505) */
export const UNIQUES: Partial<Record<TableName, Unique[]>> = {
  profiles: [{ cols: ["user_id"] }],
  subjects: [{ cols: ["user_id", "kind", "name"], when: (r) => active(r) && r.archived_at == null }],
  timetables: [{ cols: ["user_id", "default_for"], when: (r) => active(r) && r.default_for !== "none" }],
  holidays: [{ cols: ["user_id", "date"], when: active }],
  date_timetables: [{ cols: ["user_id", "date"], when: active }],
  exam_subjects: [{ cols: ["dday_id", "subject_id"], when: active }],
  tasks: [
    { cols: ["recurrence_id", "study_date"], when: (r) => r.recurrence_id != null },
    { cols: ["roadmap_item_id"], when: (r) => r.roadmap_item_id != null && active(r) },
  ],
  timer_sessions: [{ cols: ["user_id"], when: (r) => r.ended_at == null && active(r) }],
  daily_stats: [{ cols: ["user_id", "study_date", "subject_id"] }],
  reflections: [{ cols: ["user_id", "study_date"], when: active }],
  mock_rounds: [{ cols: ["user_id", "year", "month", "name"], when: active }],
  wrong_note_photos: [{ cols: ["storage_path"] }],
};

/** 외래 키: [자식 테이블, 열, 부모 테이블, 부모가 지워질 때] */
export const FOREIGN_KEYS: readonly [TableName, string, TableName, "cascade" | "set null"][] = [
  ["units", "subject_id", "subjects", "cascade"],
  ["timetable_slots", "timetable_id", "timetables", "cascade"],
  ["date_timetables", "timetable_id", "timetables", "cascade"],
  ["recurrences", "subject_id", "subjects", "set null"],
  ["ddays", "subject_id", "subjects", "set null"],
  ["exam_subjects", "dday_id", "ddays", "cascade"],
  ["exam_subjects", "subject_id", "subjects", "cascade"],
  ["roadmap_items", "dday_id", "ddays", "cascade"],
  ["roadmap_items", "subject_id", "subjects", "cascade"],
  ["tasks", "subject_id", "subjects", "set null"],
  ["tasks", "slot_id", "timetable_slots", "set null"],
  ["tasks", "recurrence_id", "recurrences", "set null"],
  ["tasks", "roadmap_item_id", "roadmap_items", "set null"],
  ["task_deferrals", "task_id", "tasks", "set null"],
  ["timer_sessions", "subject_id", "subjects", "set null"],
  ["wrong_notes", "subject_id", "subjects", "cascade"],
  ["wrong_notes", "unit_id", "units", "cascade"],
  ["wrong_notes", "mock_round_id", "mock_rounds", "cascade"],
  ["wrong_note_photos", "note_id", "wrong_notes", "cascade"],
  ["flash_decks", "subject_id", "subjects", "set null"],
  ["flash_cards", "deck_id", "flash_decks", "cascade"],
];

/** 휴지통에서 완전 삭제하는 순서 (자식 먼저) */
export const PURGE_ORDER: readonly TableName[] = [
  "wrong_note_photos",
  "wrong_notes",
  "flash_cards",
  "flash_decks",
  "tasks",
  "roadmap_items",
  "exam_subjects",
  "recurrences",
  "ddays",
  "timer_sessions",
  "reflections",
  "units",
  "mock_rounds",
  "date_timetables",
  "timetable_slots",
  "timetables",
  "holidays",
  "subjects",
];
