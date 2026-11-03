import type { TableName, TableRows } from "./database.types";

/**
 * 테이블별 열 이름 (supabase/telos.sql 과 같다).
 * 같은 내용이 세 군데(SQL·앱 타입·가짜 백엔드)에서 어긋나지 않게 이 목록 하나로 묶는다.
 * - 타입 검사: database.types.ts 의 행 타입과 빠짐없이 같아야 한다 (아래 Exact)
 * - supabase/schema-sync.test.ts: SQL 의 실제 열과 같아야 한다
 * - 가짜 백엔드(개발·E2E): 없는 열에 쓰면 실제 서버처럼 오류를 낸다
 */
type ColumnList = { [K in TableName]: readonly (keyof TableRows[K] & string)[] };

const COMMON = ["id", "user_id", "created_at", "updated_at"] as const;
const TRASH = ["deleted_at", "delete_batch_id"] as const;

export const TABLE_COLUMNS = {
  profiles: [...COMMON, "theme", "day_start_hour", "sem1_start", "sem2_start", "entry_year", "reviewed_term", "sidebar_collapsed", "last_backup_at"],
  subjects: [...COMMON, ...TRASH, "name", "color_key", "sort_order", "kind", "term", "archived_at"],
  units: [...COMMON, ...TRASH, "subject_id", "name", "sort_order"],
  timetables: [...COMMON, ...TRASH, "name", "default_for", "sort_order"],
  timetable_slots: [...COMMON, ...TRASH, "timetable_id", "name", "category", "start_min", "end_min"],
  holidays: [...COMMON, ...TRASH, "date", "name"],
  date_timetables: [...COMMON, ...TRASH, "date", "timetable_id"],
  recurrences: [...COMMON, ...TRASH, "subject_id", "title", "est_minutes", "rule", "start_date", "end_date", "default_slot_name", "default_start_min"],
  ddays: [...COMMON, ...TRASH, "type", "title", "date", "subject_id", "pinned", "pin_order", "status", "prep_percent", "perf_kind", "memo", "exam_kind"],
  exam_subjects: [...COMMON, ...TRASH, "dday_id", "subject_id", "exam_date", "range_note", "sort_order"],
  roadmap_items: [...COMMON, ...TRASH, "dday_id", "subject_id", "study_date", "content", "round", "done_at", "sort_order"],
  tasks: [
    ...COMMON,
    ...TRASH,
    "subject_id",
    "title",
    "est_minutes",
    "study_date",
    "sort_order",
    "done_at",
    "deferred_count",
    "missed_streak",
    "must_do",
    "start_min",
    "end_min",
    "slot_id",
    "source",
    "recurrence_id",
    "roadmap_item_id",
  ],
  task_deferrals: [...COMMON, "task_id", "subject_id", "title", "from_date", "to_date"],
  timer_sessions: [...COMMON, ...TRASH, "kind", "subject_id", "started_at", "ended_at", "device_label"],
  daily_stats: [...COMMON, "study_date", "subject_id", "study_seconds", "nap_seconds", "nap_count", "planned_tasks", "done_tasks", "deferred_events"],
  reflections: [...COMMON, ...TRASH, "study_date", "comment"],
  mock_rounds: [...COMMON, ...TRASH, "year", "month", "name"],
  wrong_notes: [...COMMON, ...TRASH, "kind", "subject_id", "unit_id", "mock_round_id", "source", "question_no", "points", "reason", "memo", "solved_at"],
  wrong_note_photos: [...COMMON, ...TRASH, "note_id", "storage_path", "sort_order", "width", "height"],
  flash_decks: [...COMMON, ...TRASH, "title", "subject_id", "sort_order"],
  flash_cards: [...COMMON, ...TRASH, "deck_id", "front", "back", "known", "sort_order"],
  pending_file_deletions: [...COMMON, "storage_path"],
  maintenance_runs: ["id", "ran_at", "ok", "detail"],
} as const satisfies ColumnList;

// 행 타입에 있는데 목록에 빠진 열이 있으면 여기서 타입 오류가 난다
type Missing = { [K in TableName]: Exclude<keyof TableRows[K], (typeof TABLE_COLUMNS)[K][number]> }[TableName];
type Exact = [Missing] extends [never] ? true : Missing;
export const COLUMNS_MATCH_TYPES: Exact = true;

const SETS = new Map<TableName, ReadonlySet<string>>(
  (Object.keys(TABLE_COLUMNS) as TableName[]).map((t) => [t, new Set<string>(TABLE_COLUMNS[t])]),
);

/** 표에 없는 열 이름들 (없으면 빈 배열) */
export function unknownColumns(table: TableName, row: Record<string, unknown>): string[] {
  const cols = SETS.get(table);
  return cols ? Object.keys(row).filter((k) => !cols.has(k)) : [];
}

/** 표에 있는 열만 남긴다 (restore_backup 의 jsonb_populate_record 처럼 모르는 칸은 버린다) */
export function pickColumns(table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const cols = SETS.get(table);
  return cols ? Object.fromEntries(Object.entries(row).filter(([k]) => cols.has(k))) : row;
}
