/**
 * 데이터베이스 타입 (supabase/telos.sql 과 맞춘다).
 * Supabase CLI 로 만들 수 없는 환경이라 직접 쓴다. SQL 을 바꾸면 여기도 함께 바꾼다.
 */
import type { SubjectColorKey } from "@/lib/design/subject-colors";
import type { ThemePreference } from "@/lib/theme/theme";

type Base = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type Trashable = {
  deleted_at: string | null;
  delete_batch_id: string | null;
};

export type ProfileRow = Base & {
  theme: ThemePreference;
  day_start_hour: number;
  sem1_start: string;
  sem1_end: string;
  sem2_start: string;
  sem2_end: string;
  auto_range_tasks: boolean;
  sidebar_collapsed: boolean;
  last_backup_at: string | null;
};

export type SubjectRow = Base &
  Trashable & {
    name: string;
    color_key: SubjectColorKey;
    sort_order: number;
    show_in_school_notes: boolean;
    show_in_mock_notes: boolean;
    mock_max_score: number | null;
    has_percentile: boolean;
    hidden_at: string | null;
  };

export type UnitStatus = "todo" | "doing" | "done";
export type UnitRow = Base &
  Trashable & {
    subject_id: string;
    name: string;
    sort_order: number;
    status: UnitStatus;
  };

export type TimetableDefault = "weekday" | "weekend" | "none";
export type TimetableRow = Base &
  Trashable & {
    name: string;
    default_for: TimetableDefault;
    sort_order: number;
  };

export type SlotCategory = "class" | "study" | "meal" | "life";
export type TimetableSlotRow = Base &
  Trashable & {
    timetable_id: string;
    name: string;
    category: SlotCategory;
    start_min: number;
    end_min: number;
  };

export type HolidayRow = Base & Trashable & { date: string; name: string };
export type DateTimetableRow = Base & Trashable & { date: string; timetable_id: string };

export type RecurrenceRule =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] }
  | { type: "biweekly"; days: number[] };

export type RecurrenceRow = Base &
  Trashable & {
    subject_id: string | null;
    title: string;
    est_minutes: number | null;
    rule: RecurrenceRule;
    start_date: string;
    end_date: string | null;
    default_slot_name: string | null;
    default_start_min: number | null;
  };

export type GoalLevel = "long" | "month" | "week";
export type GoalRow = Base &
  Trashable & {
    title: string;
    subject_id: string | null;
    level: GoalLevel;
    start_date: string;
    end_date: string;
    parent_id: string | null;
    sort_order: number;
    done_at: string | null;
    memo: string | null;
  };

export type DdayType = "exam" | "performance" | "etc";
export type PerfStatus = "todo" | "doing" | "done";
export type PerfKind = "report" | "presentation" | "experiment" | "writing" | "debate" | "etc";
export type DdayRow = Base &
  Trashable & {
    type: DdayType;
    title: string;
    date: string;
    subject_id: string | null;
    pinned: boolean;
    pin_order: number;
    status: PerfStatus;
    prep_percent: number | null;
    perf_kind: PerfKind | null;
    memo: string | null;
    review_days: number;
    off_weekdays: number[];
  };

export type ExamSubjectDateRow = Base & Trashable & { dday_id: string; subject_id: string; date: string };

export type RangeUnit = "page" | "unit" | "chapter" | "problem";
export type RangeItemRow = Base &
  Trashable & {
    dday_id: string;
    subject_id: string;
    name: string;
    unit_label: RangeUnit;
    start_no: number;
    end_no: number;
    done_amount: number;
    sort_order: number;
    default_slot_name: string | null;
    default_start_min: number | null;
  };

export type ReviewCheckRow = Base &
  Trashable & {
    dday_id: string;
    unit_id: string;
    round1: boolean;
    round2: boolean;
    round3: boolean;
  };

export type TaskSource = "manual" | "recurrence" | "range" | "goal";
export type TaskRow = Base &
  Trashable & {
    subject_id: string | null;
    title: string;
    est_minutes: number | null;
    study_date: string;
    sort_order: number;
    done_at: string | null;
    deferred_count: number;
    missed_streak: number;
    must_do: boolean;
    start_min: number | null;
    end_min: number | null;
    slot_id: string | null;
    source: TaskSource;
    recurrence_id: string | null;
    range_item_id: string | null;
    range_start_no: number | null;
    range_end_no: number | null;
    goal_id: string | null;
  };

export type TaskDeferralRow = Base & {
  task_id: string | null;
  subject_id: string | null;
  title: string;
  from_date: string;
  to_date: string;
};

export type SessionKind = "study" | "nap";
export type TimerSessionRow = Base &
  Trashable & {
    kind: SessionKind;
    subject_id: string | null;
    started_at: string;
    ended_at: string | null;
    device_label: string | null;
  };

export type DailyStatRow = Base & {
  study_date: string;
  subject_id: string | null;
  study_seconds: number;
  nap_seconds: number;
  nap_count: number;
  planned_tasks: number;
  done_tasks: number;
  deferred_events: number;
};

export type ReflectionRow = Base &
  Trashable & {
    study_date: string;
    good: string;
    bad: string;
    tomorrow: string;
    condition: number | null;
  };

export type MockRoundRow = Base & Trashable & { year: number; month: number; name: string };

export type NoteKind = "school" | "mock";
export type NoteReason = "concept" | "slip" | "time";
export type WrongNoteRow = Base &
  Trashable & {
    kind: NoteKind;
    subject_id: string;
    unit_id: string | null;
    mock_round_id: string | null;
    source: string | null;
    question_no: number | null;
    points: number | null;
    reason: NoteReason;
    memo: string | null;
    solved_at: string | null;
  };

export type WrongNotePhotoRow = Base &
  Trashable & {
    note_id: string;
    storage_path: string;
    sort_order: number;
    width: number | null;
    height: number | null;
  };

export type FlashDeckRow = Base & Trashable & { title: string; subject_id: string | null; sort_order: number };
export type FlashCardRow = Base &
  Trashable & { deck_id: string; front: string; back: string; known: boolean; sort_order: number };

export type Achievement = "A" | "B" | "C" | "D" | "E";
export type SchoolGradeRow = Base &
  Trashable & {
    year: number;
    semester: number;
    subject_id: string;
    credits: number;
    raw_score: number;
    subject_avg: number | null;
    achievement: Achievement | null;
    rank: number | null;
    tie_count: number;
    total_students: number | null;
    grade: number | null;
    grade_manual: boolean;
  };

export type MockScoreRow = Base &
  Trashable & {
    mock_round_id: string;
    subject_id: string;
    raw_score: number | null;
    percentile: number | null;
    grade: number | null;
  };

export type TargetRow = Base &
  Trashable & { subject_id: string; school_target: number | null; mock_target: number | null };

export type RecordKind = "seteuk" | "reading" | "club" | "etc";
export type RecordRow = Base &
  Trashable & {
    kind: RecordKind;
    subject_id: string | null;
    title: string;
    date: string;
    content: string;
  };

export type PendingFileDeletionRow = Base & { storage_path: string };

export type MaintenanceRunRow = { id: number; ran_at: string; ok: boolean; detail: string | null };

/** 테이블 이름 → 행 타입 */
export type TableRows = {
  profiles: ProfileRow;
  subjects: SubjectRow;
  units: UnitRow;
  timetables: TimetableRow;
  timetable_slots: TimetableSlotRow;
  holidays: HolidayRow;
  date_timetables: DateTimetableRow;
  recurrences: RecurrenceRow;
  goals: GoalRow;
  ddays: DdayRow;
  exam_subject_dates: ExamSubjectDateRow;
  range_items: RangeItemRow;
  review_checks: ReviewCheckRow;
  tasks: TaskRow;
  task_deferrals: TaskDeferralRow;
  timer_sessions: TimerSessionRow;
  daily_stats: DailyStatRow;
  reflections: ReflectionRow;
  mock_rounds: MockRoundRow;
  wrong_notes: WrongNoteRow;
  wrong_note_photos: WrongNotePhotoRow;
  flash_decks: FlashDeckRow;
  flash_cards: FlashCardRow;
  school_grades: SchoolGradeRow;
  mock_scores: MockScoreRow;
  targets: TargetRow;
  records: RecordRow;
  pending_file_deletions: PendingFileDeletionRow;
  maintenance_runs: MaintenanceRunRow;
};

export type TableName = keyof TableRows;

/** 휴지통을 쓰는 테이블 */
export const TRASHABLE_TABLES = [
  "subjects",
  "units",
  "timetables",
  "timetable_slots",
  "holidays",
  "date_timetables",
  "recurrences",
  "goals",
  "ddays",
  "exam_subject_dates",
  "range_items",
  "review_checks",
  "tasks",
  "timer_sessions",
  "reflections",
  "mock_rounds",
  "wrong_notes",
  "wrong_note_photos",
  "flash_decks",
  "flash_cards",
  "school_grades",
  "mock_scores",
  "targets",
  "records",
] as const satisfies readonly TableName[];
export type TrashableTable = (typeof TRASHABLE_TABLES)[number];

/** 백업에 들어가는 테이블 (restore_backup 의 순서와 무관) */
export const BACKUP_TABLES = [...TRASHABLE_TABLES, "task_deferrals", "daily_stats"] as const satisfies readonly TableName[];
export type BackupTable = (typeof BACKUP_TABLES)[number];

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type Tables = { [K in TableName]: TableDef<TableRows[K]> };

export type Database = {
  public: {
    Tables: Tables;
    Views: { [_ in never]: never };
    Functions: {
      bootstrap_user: { Args: Record<PropertyKey, never>; Returns: undefined };
      reorder_rows: { Args: { p_table: string; p_ids: string[] }; Returns: undefined };
      trash_item: { Args: { p_table: TrashableTable; p_id: string }; Returns: string };
      restore_batch: { Args: { p_batch: string }; Returns: undefined };
      purge_batch: { Args: { p_batch: string }; Returns: undefined };
      defer_tasks: { Args: { p_ids: string[]; p_to: string }; Returns: string[] };
      undefer_tasks: { Args: { p_ids: string[] }; Returns: undefined };
      refresh_daily_stats: { Args: { p_from: string; p_to: string }; Returns: undefined };
      restore_backup: { Args: { p_backup: unknown }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type { SubjectColorKey };
