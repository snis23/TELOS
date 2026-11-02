import { MOCK_SUBJECTS } from "@/lib/defaults";
import { BACKUP_TABLES, type BackupTable, type ProfileRow } from "@/lib/supabase/database.types";

/** 9.5 데이터 백업 */

export const BACKUP_APP = "telos";
export const BACKUP_VERSION = 2;
export const BACKUP_REMIND_DAYS = 30;

export type Backup = {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exported_at: string;
  profile: Partial<ProfileRow> | null;
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>;
};

export function buildBackup(
  profile: Partial<ProfileRow> | null,
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>,
  now: Date = new Date(),
): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exported_at: now.toISOString(), profile, tables };
}

export type BackupCheck =
  | { ok: true; backup: Backup; counts: { table: BackupTable; rows: number }[]; total: number }
  | { ok: false; reason: string };

/** 복원 전에 파일을 검사한다: 앱 이름, 버전, 표 모양 */
export function checkBackup(text: string): BackupCheck {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "JSON 파일이 아니에요" };
  }
  const raw = data as { app?: unknown; version?: unknown } | null;
  if (!raw || typeof raw !== "object" || raw.app !== BACKUP_APP) return { ok: false, reason: "TELOS 백업 파일이 아니에요" };
  if (raw.version !== 1 && raw.version !== BACKUP_VERSION) return { ok: false, reason: "지원하지 않는 백업 버전이에요" };
  const b = (raw.version === 1 ? upgradeV1(raw as V1Backup) : raw) as Partial<Backup>;
  if (!b.tables || typeof b.tables !== "object") return { ok: false, reason: "백업 내용이 비어 있어요" };
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(name)) return { ok: false, reason: `알 수 없는 표가 있어요: ${name}` };
    if (!Array.isArray(rows)) return { ok: false, reason: `${name} 표의 형식이 맞지 않아요` };
  }
  const counts = BACKUP_TABLES.map((t) => ({ table: t, rows: (b.tables as Backup["tables"])[t]?.length ?? 0 }));
  return { ok: true, backup: b as Backup, counts, total: counts.reduce((s, c) => s + c.rows, 0) };
}

type Rows = Record<string, unknown>[];
type V1Backup = { exported_at?: string; profile?: Record<string, unknown> | null; tables?: Record<string, Rows> };

const MOCK_NAMES = new Set(MOCK_SUBJECTS.map((s) => s.name));
const RENAMED: Record<string, string> = { 과학: "통합과학", 사회: "통합사회" };

/**
 * 이전 버전(1) 백업을 지금 구조(2)로 바꾼다 (supabase/telos.sql 2.99 와 같은 규칙).
 * 성적·생기부·목표·범위 분배·회독 표는 버린다.
 */
export function upgradeV1(v1: V1Backup): Backup {
  const t = v1.tables ?? {};
  const keep = (name: string) => (Array.isArray(t[name]) ? t[name] : []);
  const subjects = keep("subjects").map((row) => {
    const name = RENAMED[String(row.name)] ?? String(row.name);
    const tamgu = name === "탐구1" || name === "탐구2";
    return {
      ...row,
      name,
      kind: MOCK_NAMES.has(name) || tamgu ? "mock" : "school",
      term: null,
      archived_at: tamgu ? (v1.exported_at ?? new Date().toISOString()) : null,
    };
  });
  const reflections = keep("reflections").map((row) => ({
    ...row,
    comment: [row.good, row.bad, row.tomorrow]
      .filter((x) => typeof x === "string" && x !== "")
      .join("\n")
      .slice(0, 500),
  }));
  const ddays = keep("ddays").map((row) => ({ ...row, exam_kind: row.type === "exam" ? "other" : null }));
  const tasks = keep("tasks").map((row) => ({
    ...row,
    source: row.source === "recurrence" ? "recurrence" : "manual",
    roadmap_item_id: null,
  }));
  const tables: Backup["tables"] = { subjects, reflections, ddays, tasks };
  for (const name of BACKUP_TABLES) {
    if (!(name in tables) && Array.isArray(t[name])) tables[name] = t[name];
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: v1.exported_at ?? new Date().toISOString(),
    profile: (v1.profile ?? null) as Partial<ProfileRow> | null,
    tables,
  };
}

/** 마지막 백업 후 30일이 지났는지 (백업한 적이 없으면 계정을 만든 날부터) */
export function backupDue(lastBackupAt: string | null, createdAt: string, now: Date = new Date()): boolean {
  const basis = new Date(lastBackupAt ?? createdAt).getTime();
  return now.getTime() - basis > BACKUP_REMIND_DAYS * 24 * 3600 * 1000;
}

export const TABLE_LABELS: Record<BackupTable, string> = {
  subjects: "과목",
  units: "단원",
  timetables: "시간표",
  timetable_slots: "시간표 항목",
  holidays: "공휴일",
  date_timetables: "날짜별 시간표",
  recurrences: "반복 할 일",
  ddays: "일정·시험",
  exam_subjects: "시험 과목",
  roadmap_items: "로드맵 계획",
  tasks: "할 일",
  timer_sessions: "공부·쪽잠 기록",
  reflections: "하루 코멘트",
  mock_rounds: "모의고사 회차",
  wrong_notes: "오답",
  wrong_note_photos: "오답 사진",
  flash_decks: "암기 카드 묶음",
  flash_cards: "암기 카드",
  task_deferrals: "미룬 기록",
  daily_stats: "하루 통계",
};

export function backupFileName(kind: "json" | "zip", date: string): string {
  return kind === "json" ? `telos-backup-${date}.json` : `telos-photos-${date}.zip`;
}
