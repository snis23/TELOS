/**
 * 가짜 PostgREST 쿼리 빌더. supabase-js 의 from() 체인 중 앱이 쓰는 것만 구현한다.
 */
import type { TableName } from "../database.types";
import { FakeError, pgError, type FakeStore, type PgError, type Row } from "./store";

type Filter = (row: Row) => boolean;
type Result = { data: unknown; error: PgError | null; count: number | null; status: number; statusText: string };

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function pick(row: Row, columns: string): Row {
  if (columns.trim() === "*" || columns.trim() === "") return row;
  const out: Row = {};
  for (const col of columns.split(",").map((c) => c.trim()).filter(Boolean)) out[col] = row[col];
  return out;
}

export class FakeQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private returning = false;
  private columns = "*";
  private countMode: "exact" | null = null;
  private head = false;
  private singleMode: "single" | "maybe" | null = null;
  private conflictCols: string[] = ["id"];
  private ignoreDuplicates = false;

  constructor(
    private readonly store: FakeStore,
    private readonly table: TableName,
  ) {}

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    if (this.mode === "select") {
      this.columns = columns;
      this.countMode = options?.count ?? null;
      this.head = options?.head ?? false;
    } else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    if (options?.onConflict) this.conflictCols = options.onConflict.split(",").map((c) => c.trim());
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false;
    return this;
  }

  update(values: Row) {
    this.mode = "update";
    this.patch = values;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push((r) => r[col] !== value);
    return this;
  }
  is(col: string, value: null | boolean) {
    this.filters.push((r) => (value === null ? r[col] == null : r[col] === value));
    return this;
  }
  in(col: string, values: readonly unknown[]) {
    const set = new Set(values);
    this.filters.push((r) => set.has(r[col]));
    return this;
  }
  gte(col: string, value: unknown) {
    this.filters.push((r) => r[col] != null && compare(r[col], value) >= 0);
    return this;
  }
  gt(col: string, value: unknown) {
    this.filters.push((r) => r[col] != null && compare(r[col], value) > 0);
    return this;
  }
  lte(col: string, value: unknown) {
    this.filters.push((r) => r[col] != null && compare(r[col], value) <= 0);
    return this;
  }
  lt(col: string, value: unknown) {
    this.filters.push((r) => r[col] != null && compare(r[col], value) < 0);
    return this;
  }
  not(col: string, op: string, value: unknown) {
    if (op === "is" && value === null) this.filters.push((r) => r[col] != null);
    else if (op === "eq") this.filters.push((r) => r[col] !== value);
    else throw new Error(`fake not(${op}) is not supported`);
    return this;
  }
  match(query: Row) {
    for (const [k, v] of Object.entries(query)) this.eq(k, v);
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orders.push({ col, asc: options?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  private matching(): Row[] {
    return this.store.visible(this.table).filter((r) => this.filters.every((f) => f(r)));
  }

  private execute(): Result {
    let rows: Row[] = [];
    let count: number | null = null;
    switch (this.mode) {
      case "select": {
        rows = this.matching().map((r) => structuredClone(r));
        for (const o of [...this.orders].reverse()) {
          rows.sort((a, b) => (o.asc ? compare(a[o.col], b[o.col]) : compare(b[o.col], a[o.col])));
        }
        count = this.countMode ? rows.length : null;
        if (this.rangeFrom != null && this.rangeTo != null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
        if (this.limitN != null) rows = rows.slice(0, this.limitN);
        if (this.head) return { data: null, error: null, count, status: 200, statusText: "OK" };
        rows = rows.map((r) => pick(r, this.columns));
        break;
      }
      case "insert":
        rows = this.store.insert(this.table, this.payload);
        break;
      case "upsert":
        rows = this.store.insert(this.table, this.payload, { cols: this.conflictCols, ignore: this.ignoreDuplicates });
        break;
      case "update":
        rows = this.store.update(this.table, this.matching(), this.patch);
        break;
      case "delete":
        rows = this.store.delete(this.table, this.matching());
        break;
    }

    if (this.mode !== "select" && !this.returning) {
      return { data: null, error: null, count: null, status: 204, statusText: "No Content" };
    }
    if (this.singleMode) {
      if (rows.length === 1) return { data: rows[0], error: null, count, status: 200, statusText: "OK" };
      if (rows.length === 0 && this.singleMode === "maybe") return { data: null, error: null, count, status: 200, statusText: "OK" };
      return {
        data: null,
        error: pgError("PGRST116", `JSON object requested, multiple (or no) rows returned (${rows.length})`),
        count,
        status: 406,
        statusText: "Not Acceptable",
      };
    }
    return { data: rows, error: null, count, status: 200, statusText: "OK" };
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const run = async (): Promise<Result> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        return this.execute();
      } catch (error) {
        if (error instanceof FakeError) {
          return { data: null, error: error.pg, count: null, status: 409, statusText: "Conflict" };
        }
        throw error;
      }
    };
    return run().then(onfulfilled, onrejected);
  }
}
