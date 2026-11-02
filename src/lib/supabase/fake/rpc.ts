/**
 * 가짜 백엔드의 앱용 함수 (supabase/telos.sql 의 함수와 같은 동작).
 */
import { DEFAULT_HOLIDAYS, DEFAULT_TIMETABLES, MOCK_SUBJECTS } from "@/lib/defaults";
import { addDays } from "@/lib/date/days";
import { clockToDayMin } from "@/lib/timetable/time";
import { computeDailyStats } from "@/lib/stats/daily";
import { pickColumns } from "../columns";
import { BACKUP_TABLES, type TableName } from "../database.types";
import { HAS_TRASH, PURGE_ORDER } from "./schema";
import { FakeError, pgError, type FakeStore, type Row } from "./store";

type Args = Record<string, unknown>;

const TRASH_TABLES = HAS_TRASH;
const REORDER_TABLES = new Set<TableName>([
  "subjects",
  "units",
  "tasks",
  "ddays",
  "timetables",
  "exam_subjects",
  "roadmap_items",
  "flash_decks",
  "flash_cards",
  "wrong_note_photos",
]);

function bootstrap(store: FakeStore) {
  store.insert("profiles", [{ user_id: store.userId }], { cols: ["user_id"], ignore: true });
  // 모의고사 과목은 고정: 빠진 것만 채운다
  const have = new Set(store.visible("subjects").filter((s) => s.kind === "mock" && s.deleted_at == null).map((s) => s.name));
  const missing = MOCK_SUBJECTS.map((s, i) => ({ ...s, kind: "mock", sort_order: i })).filter((s) => !have.has(s.name));
  if (missing.length) store.insert("subjects", missing);
  const profile = store.visible("profiles")[0];
  const h = Number(profile?.day_start_hour ?? 6);
  if (store.visible("timetables").length === 0) {
    DEFAULT_TIMETABLES.forEach((tt, i) => {
      const [table] = store.insert("timetables", [{ name: tt.name, default_for: tt.default_for, sort_order: i }]);
      store.insert(
        "timetable_slots",
        tt.slots.map((s) => {
          const start = clockToDayMin(s.start, h);
          return { timetable_id: table.id, name: s.name, category: s.category, start_min: start, end_min: start + (s.end - s.start) };
        }),
      );
    });
  }
  if (store.visible("holidays").length === 0) {
    store.insert(
      "holidays",
      DEFAULT_HOLIDAYS.map(([date, name]) => ({ date, name })),
    );
  }
  return null;
}

function reorder(store: FakeStore, args: Args) {
  const table = args.p_table as TableName;
  if (!REORDER_TABLES.has(table)) throw new FakeError(pgError("22023", `reorder not allowed: ${table}`));
  const col = table === "ddays" ? "pin_order" : "sort_order";
  const ids = args.p_ids as string[];
  ids.forEach((id, index) => {
    const row = store.visible(table).find((r) => r.id === id);
    if (row) store.update(table, [row], { [col]: index });
  });
  return null;
}

function trashItem(store: FakeStore, args: Args) {
  const table = args.p_table as TableName;
  const id = args.p_id as string;
  if (!TRASH_TABLES.has(table)) throw new FakeError(pgError("22023", `trash not allowed: ${table}`));
  const ts = store.now();
  const mark = (t: TableName, pred: (r: Row) => boolean) => {
    const targets = store.visible(t).filter((r) => r.deleted_at == null && pred(r));
    if (targets.length) store.update(t, targets, { deleted_at: ts, delete_batch_id: id });
  };
  mark(table, (r) => r.id === id);
  if (table === "subjects") {
    for (const t of ["wrong_notes", "units", "exam_subjects", "roadmap_items"] as const) {
      mark(t, (r) => r.subject_id === id);
    }
  } else if (table === "units") {
    mark("wrong_notes", (r) => r.unit_id === id);
  } else if (table === "mock_rounds") {
    mark("wrong_notes", (r) => r.mock_round_id === id);
  } else if (table === "ddays") {
    mark("exam_subjects", (r) => r.dday_id === id);
    mark("roadmap_items", (r) => r.dday_id === id);
  } else if (table === "flash_decks") {
    mark("flash_cards", (r) => r.deck_id === id);
  } else if (table === "timetables") {
    mark("timetable_slots", (r) => r.timetable_id === id);
  }
  return id;
}

function restoreBatch(store: FakeStore, args: Args) {
  for (const t of TRASH_TABLES) {
    const targets = store.visible(t).filter((r) => r.delete_batch_id === args.p_batch);
    if (targets.length) store.update(t, targets, { deleted_at: null, delete_batch_id: null });
  }
  return null;
}

function purgeBatch(store: FakeStore, args: Args) {
  for (const t of PURGE_ORDER) {
    const targets = store.visible(t).filter((r) => r.delete_batch_id === args.p_batch && r.deleted_at != null);
    if (targets.length) store.delete(t, targets);
  }
  return null;
}

function deferTasks(store: FakeStore, args: Args) {
  const ids = new Set(args.p_ids as string[]);
  const to = args.p_to as string;
  const moved = store
    .visible("tasks")
    .filter((t) => ids.has(t.id as string) && t.deleted_at == null && t.done_at == null && t.study_date !== to);
  for (const t of moved) {
    store.insert("task_deferrals", [
      { task_id: t.id, subject_id: t.subject_id, title: t.title, from_date: t.study_date, to_date: to },
    ]);
    store.update("tasks", [t], {
      study_date: to,
      deferred_count: Number(t.deferred_count) + 1,
      start_min: null,
      end_min: null,
      slot_id: null,
    });
  }
  return moved.map((t) => t.id);
}

function undeferTasks(store: FakeStore, args: Args) {
  for (const id of args.p_ids as string[]) {
    const logs = store
      .visible("task_deferrals")
      .filter((d) => d.task_id === id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const last = logs[0];
    if (!last) continue;
    const task = store.visible("tasks").find((t) => t.id === id);
    if (task) {
      store.update("tasks", [task], {
        study_date: last.from_date,
        deferred_count: Math.max(Number(task.deferred_count) - 1, 0),
      });
    }
    store.delete("task_deferrals", [last]);
  }
  return null;
}

export function computeStatsFor(store: FakeStore, date: string) {
  const profile = store.visible("profiles")[0];
  const h = Number(profile?.day_start_hour ?? 6);
  const rows = computeDailyStats({
    studyDate: date,
    dayStartHour: h,
    sessions: store.visible("timer_sessions") as never,
    tasks: store.visible("tasks") as never,
    deferrals: store.visible("task_deferrals") as never,
    now: new Date(),
  });
  store.delete(
    "daily_stats",
    store.visible("daily_stats").filter((r) => r.study_date === date),
  );
  store.insert(
    "daily_stats",
    rows.map((r) => ({ ...r, study_date: date })),
  );
}

function refreshStats(store: FakeStore, args: Args) {
  const from = args.p_from as string;
  const to = args.p_to as string;
  for (let d = from; d <= to; d = addDays(d, 1)) computeStatsFor(store, d);
  return null;
}

/** 복원할 때 넣는 순서 = 백업 표 지우는 순서의 반대 (restore_backup 과 같다) */
const RESTORE_INSERT_ORDER: readonly TableName[] = [...BACKUP_TABLES].reverse();

function restoreBackup(store: FakeStore, args: Args) {
  const backup = args.p_backup as { app?: string; version?: number; profile?: Row; tables?: Record<string, Row[]> };
  if (backup?.app !== "telos" || backup.version !== 2) {
    throw new FakeError(pgError("22023", "not a Telos backup"));
  }
  store.txNow = new Date().toISOString();
  try {
    for (const t of [...RESTORE_INSERT_ORDER].reverse()) store.delete(t, store.visible(t));
    for (const t of RESTORE_INSERT_ORDER) {
      // 모르는 칸은 버린다 (SQL 의 jsonb_populate_record 와 같다)
      const rows = (backup.tables?.[t] ?? []).map((r) => ({ ...pickColumns(t, r), user_id: store.userId }));
      if (rows.length) store.insert(t, rows);
    }
    const pending = store.visible("pending_file_deletions").filter((r) => r.created_at === store.txNow);
    if (pending.length) store.delete("pending_file_deletions", pending);
    const profile = store.visible("profiles")[0];
    if (profile && backup.profile) {
      const keys = ["theme", "day_start_hour", "sem1_start", "sem2_start", "entry_year", "reviewed_term", "sidebar_collapsed"];
      const patch: Row = {};
      for (const k of keys) if (backup.profile[k] != null) patch[k] = backup.profile[k];
      store.update("profiles", [profile], patch);
    }
  } finally {
    store.txNow = null;
  }
  return null;
}

export function runRpc(store: FakeStore, name: string, args: Args): unknown {
  switch (name) {
    case "bootstrap_user":
      return bootstrap(store);
    case "reorder_rows":
      return reorder(store, args);
    case "trash_item":
      return trashItem(store, args);
    case "restore_batch":
      return restoreBatch(store, args);
    case "purge_batch":
      return purgeBatch(store, args);
    case "defer_tasks":
      return deferTasks(store, args);
    case "undefer_tasks":
      return undeferTasks(store, args);
    case "refresh_daily_stats":
      return refreshStats(store, args);
    case "restore_backup":
      return restoreBackup(store, args);
    default:
      throw new FakeError(pgError("PGRST202", `Could not find the function public.${name}`));
  }
}
