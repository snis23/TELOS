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
  /** 입학 연도 (학년 계산용) */
  entry_year: number | null;
  /** 마지막으로 내신 과목을 정리한 학기 ("2-1" = 2학년 1학기) */
  reviewed_term: string | null;
  sidebar_collapsed: boolean;
  last_backup_at: string | null;
};

/** mock: 모의고사 과목(고정 6개) / school: 내신 과목(학기마다 바뀜) */
export type SubjectKind = "mock" | "school";
export type SubjectRow = Base &
  Trashable & {
    name: string;
    color_key: SubjectColorKey;
    sort_order: number;
    kind: SubjectKind;
    /** 내신 과목을 처음 배운 학기 ("1-2"), 모의고사 과목은 null */
    term: string | null;
    /** 학기가 끝나 보관한 시각. 보관한 과목은 고르는 목록에서만 빠지고 기록은 남는다 */
    archived_at: string | null;
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
    /** 시험의 종류: 내신(이번 학기 내신 과목) / 모의고사(모의고사 과목) / 기타(모든 과목) */
    exam_kind: ExamKind | null;
  };

export type ExamKind = "school" | "mock" | "other";

/** 시험에 들어가는 과목: 과목별 시험 날짜(없으면 시험 첫날)와 범위 메모 */
export type ExamSubjectRow = Base &
  Trashable & {
    dday_id: string;
    subject_id: string;
    exam_date: string | null;
    range_note: string | null;
    sort_order: number;
  };

/** 시험 대비 로드맵 달력의 한 칸 */
export type RoadmapItemRow = Base &
  Trashable & {
    dday_id: string;
    subject_id: string;
    study_date: string;
    content: string;
    /** 회독 (1~5), 없으면 null */
    round: number | null;
    done_at: string | null;
    sort_order: number;
  };

export type TaskSource = "manual" | "recurrence" | "roadmap";
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
    roadmap_item_id: string | null;
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

/** 하루 코멘트 (하루에 하나) */
export type ReflectionRow = Base &
  Trashable & {
    study_date: string;
    comment: string;
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
  ddays: DdayRow;
  exam_subjects: ExamSubjectRow;
  roadmap_items: RoadmapItemRow;
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
