/**
 * 가짜 백엔드 저장소: 테이블을 메모리에 두고 localStorage 에 저장한다.
 * PostgREST 의 동작 중 앱이 쓰는 부분(기본값, 고유 제약, 외래 키 연쇄)만 흉내 낸다.
 */
import { unknownColumns } from "../columns";
import type { TableName } from "../database.types";
import { FOREIGN_KEYS, HAS_TRASH, TABLE_DEFAULTS, UNIQUES } from "./schema";

export type Row = Record<string, unknown>;
export type PgError = { code: string; message: string; details: string | null; hint: string | null };

export function pgError(code: string, message: string): PgError {
  return { code, message, details: null, hint: null };
}

export class FakeError extends Error {
  constructor(public readonly pg: PgError) {
    super(pg.message);
  }
}

function uuid(): string {
  return crypto.randomUUID();
}

export class FakeStore {
  private tables = new Map<TableName, Row[]>();
  private seq = 1;
  /** 현재 트랜잭션 시각 (트리거와 restore_backup 이 같은 now() 를 보도록) */
  txNow: string | null = null;

  constructor(
    private readonly storageKey: string,
    public userId: string,
  ) {
    this.load();
  }

  private load() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { tables: Record<string, Row[]>; seq?: number };
      for (const [name, rows] of Object.entries(parsed.tables)) this.tables.set(name as TableName, rows);
      this.seq = parsed.seq ?? 1;
    } catch {
      // 저장된 값이 깨졌으면 새로 시작
    }
  }

  /** 바뀔 때마다 바로 쓴다 (화면을 빨리 옮겨도 잃지 않게) */
  private scheduleSave() {
    this.flush();
  }

  flush() {
    try {
      const tables: Record<string, Row[]> = {};
      for (const [name, rows] of this.tables) tables[name] = rows;
      window.localStorage.setItem(this.storageKey, JSON.stringify({ tables, seq: this.seq }));
    } catch {
      // 저장 공간이 모자라도 이번 세션 동안은 동작한다
    }
  }

  now(): string {
    return this.txNow ?? new Date().toISOString();
  }

  rows(table: TableName): Row[] {
    let list = this.tables.get(table);
    if (!list) {
      list = [];
      this.tables.set(table, list);
    }
    return list;
  }

  /** 현재 사용자 행만 (RLS) */
  visible(table: TableName): Row[] {
    if (table === "maintenance_runs") return this.rows(table);
    return this.rows(table).filter((r) => r.user_id === this.userId);
  }

  private withDefaults(table: TableName, input: Row): Row {
    const now = this.now();
    const base: Row =
      table === "maintenance_runs"
        ? { id: this.seq++, ran_at: now, ok: true, detail: null }
        : { id: uuid(), user_id: this.userId, created_at: now, updated_at: now, deleted_at: null, delete_batch_id: null };
    const row: Row = { ...base, ...structuredClone(TABLE_DEFAULTS[table]), ...input };
    if (table !== "maintenance_runs") row.user_id = input.user_id ?? this.userId;
    if (!("deleted_at" in TABLE_DEFAULTS[table]) && !hasTrash(table)) {
      delete row.deleted_at;
      delete row.delete_batch_id;
    }
    return row;
  }

  /** 실제 서버(PostgREST)처럼 없는 열에 쓰면 오류 */
  private checkColumns(table: TableName, row: Row) {
    const unknown = unknownColumns(table, row);
    if (unknown.length) {
      throw new FakeError(pgError("PGRST204", `Could not find the '${unknown[0]}' column of '${table}' in the schema cache`));
    }
  }

  private checkUnique(table: TableName, candidate: Row, ignoreId?: unknown) {
    for (const u of UNIQUES[table] ?? []) {
      if (u.when && !u.when(candidate)) continue;
      const clash = this.rows(table).some(
        (r) =>
          r.id !== ignoreId &&
          r.id !== candidate.id &&
          (!u.when || u.when(r)) &&
          u.cols.every((c) => (r[c] ?? null) === (candidate[c] ?? null)),
      );
      if (clash) throw new FakeError(pgError("23505", `duplicate key value violates unique constraint on ${table}`));
    }
  }

  insert(table: TableName, inputs: Row[], onConflict?: { cols: string[]; ignore?: boolean }): Row[] {
    const created: Row[] = [];
    for (const input of inputs) {
      if (input.user_id && input.user_id !== this.userId && table !== "maintenance_runs") {
        throw new FakeError(pgError("42501", "new row violates row-level security policy"));
      }
      this.checkColumns(table, input);
      const row = this.withDefaults(table, input);
      if (onConflict) {
        const existing = this.rows(table).find((r) => onConflict.cols.every((c) => r[c] === row[c]));
        if (existing) {
          if (onConflict.ignore) continue;
          Object.assign(existing, input, { updated_at: this.now() });
          created.push(existing);
          continue;
        }
      }
      if (this.rows(table).some((r) => r.id === row.id)) {
        throw new FakeError(pgError("23505", `duplicate key value violates unique constraint "${table}_pkey"`));
      }
      this.checkUnique(table, row);
      this.rows(table).push(row);
      created.push(row);
    }
    this.scheduleSave();
    return created.map((r) => structuredClone(r));
  }

  update(table: TableName, targets: Row[], patch: Row): Row[] {
    this.checkColumns(table, patch);
    const updated: Row[] = [];
    for (const target of targets) {
      const next = { ...target, ...patch };
      if ("updated_at" in target) next.updated_at = this.now();
      this.checkUnique(table, next, target.id);
      Object.assign(target, next);
      updated.push(target);
    }
    this.scheduleSave();
    return updated.map((r) => structuredClone(r));
  }

  delete(table: TableName, targets: Row[]): Row[] {
    const ids = new Set(targets.map((t) => t.id));
    const removed = this.rows(table).filter((r) => ids.has(r.id));
    this.tables.set(
      table,
      this.rows(table).filter((r) => !ids.has(r.id)),
    );
    // 트리거: 오답 사진을 지우면 파일 삭제 대기열에
    if (table === "wrong_note_photos") {
      for (const r of removed) {
        this.rows("pending_file_deletions").push(
          this.withDefaults("pending_file_deletions", { user_id: r.user_id, storage_path: r.storage_path }),
        );
      }
    }
    // 외래 키 연쇄
    for (const [child, col, parent, action] of FOREIGN_KEYS) {
      if (parent !== table) continue;
      const affected = this.rows(child).filter((r) => r[col] != null && ids.has(r[col]));
      if (affected.length === 0) continue;
      if (action === "cascade") this.delete(child, affected);
      else for (const r of affected) r[col] = null;
    }
    this.scheduleSave();
    return removed.map((r) => structuredClone(r));
  }
}

export function hasTrash(table: TableName): boolean {
  return HAS_TRASH.has(table);
}
