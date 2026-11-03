// @vitest-environment node
/**
 * 같은 내용을 세 군데(SQL · 앱 타입 · 개발용 가짜 백엔드)에 쓰는 곳이 어긋나지 않는지 확인한다.
 * SQL 을 바꾸고 다른 곳을 빠뜨리면 여기서 실패한다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { TABLE_COLUMNS } from "@/lib/supabase/columns";
import { BACKUP_TABLES, TRASHABLE_TABLES, type TableName } from "@/lib/supabase/database.types";
import { FOREIGN_KEYS, TABLE_DEFAULTS, UNIQUES } from "@/lib/supabase/fake/schema";
import { SQL, createDb, type TestDb } from "./test-db";

let t: TestDb;
/** SQL 표 → 열 정보 */
const sqlColumns = new Map<string, { name: string; nullable: boolean; def: string | null }[]>();
const AUTO = new Set(["id", "user_id", "created_at", "updated_at", "deleted_at", "delete_batch_id"]);
const INTERNAL = new Set(["schema_migrations"]);

beforeAll(async () => {
  t = await createDb([]);
  await t.db.exec(SQL.latest());
  const rows = await t.q<{ t: string; c: string; n: string; d: string | null }>(
    `select table_name t, column_name c, is_nullable n, column_default d
     from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`,
  );
  for (const r of rows) {
    if (INTERNAL.has(r.t)) continue;
    sqlColumns.set(r.t, [...(sqlColumns.get(r.t) ?? []), { name: r.c, nullable: r.n === "YES", def: r.d }]);
  }
}, 60_000);

/** SQL 기본값 글자 → 값 ('system'::text → "system", 6 → 6, false → false, '{}'::smallint[] → []). 계산식은 undefined */
function literal(def: string | null): unknown {
  if (def == null) return null;
  const str = /^'(.*)'::[\w\s[\]]+$/.exec(def);
  if (str) return str[1] === "{}" && def.endsWith("[]") ? [] : str[1];
  if (/^-?\d+(\.\d+)?$/.test(def)) return Number(def);
  if (def === "true" || def === "false") return def === "true";
  return undefined;
}

describe("SQL · 앱 · 가짜 백엔드 일치", () => {
  it("표와 열: SQL = TABLE_COLUMNS (TABLE_COLUMNS 는 타입 검사로 앱 행 타입과 같다)", () => {
    expect([...sqlColumns.keys()].sort()).toEqual(Object.keys(TABLE_COLUMNS).sort());
    for (const [table, cols] of sqlColumns) {
      expect(cols.map((c) => c.name).sort(), table).toEqual([...TABLE_COLUMNS[table as TableName]].sort());
    }
  });

  it("휴지통 표: SQL telos_trash_tables() = 앱 TRASHABLE_TABLES (순서까지) = deleted_at 열이 있는 표", async () => {
    const [{ list }] = await t.q<{ list: string[] }>("select public.telos_trash_tables() list");
    expect(list).toEqual([...TRASHABLE_TABLES]);
    const withTrash = [...sqlColumns].filter(([, cols]) => cols.some((c) => c.name === "deleted_at")).map(([n]) => n);
    expect(withTrash.sort()).toEqual([...TRASHABLE_TABLES].sort());
  });

  it("백업: 사용자 기록 표가 빠짐없이 백업에 들어간다 (설정·파일 대기열 제외)", () => {
    const userTables = [...sqlColumns].filter(([, cols]) => cols.some((c) => c.name === "user_id")).map(([n]) => n);
    const expected = userTables.filter((n) => n !== "profiles" && n !== "pending_file_deletions");
    expect([...BACKUP_TABLES].sort()).toEqual(expected.sort());
  });

  it("가짜 백엔드 기본값: 비어 있을 수 있거나 기본값이 있는 열은 모두 채우고, 값도 SQL 과 같다", () => {
    for (const [table, cols] of sqlColumns) {
      if (table === "maintenance_runs") continue;
      const defaults = TABLE_DEFAULTS[table as TableName] as Record<string, unknown>;
      for (const key of Object.keys(defaults)) expect(cols.some((c) => c.name === key), `${table}.${key} 은 SQL 에 없는 열`).toBe(true);
      for (const c of cols) {
        if (AUTO.has(c.name) || (!c.nullable && c.def == null)) continue;
        expect(c.name in defaults, `${table}.${c.name} 기본값이 가짜 백엔드에 없음`).toBe(true);
        const v = literal(c.def);
        if (v !== undefined) expect(defaults[c.name], `${table}.${c.name} 기본값`).toEqual(v);
      }
    }
  });

  it("외래 키: SQL = 가짜 백엔드 FOREIGN_KEYS (지울 때 동작 포함)", async () => {
    const rows = await t.q<{ child: string; col: string; parent: string; rule: string }>(
      `select tc.table_name child, kcu.column_name col, ccu.table_name parent, rc.delete_rule rule
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
       join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
       join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
       where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY' and ccu.table_schema = 'public'`,
    );
    const sql = rows.map((r) => `${r.child}.${r.col} → ${r.parent} ${r.rule.toLowerCase()}`).sort();
    const fake = FOREIGN_KEYS.map(([child, col, parent, action]) => `${child}.${col} → ${parent} ${action}`).sort();
    expect(fake).toEqual(sql);
  });

  it("고유 제약: SQL 의 고유 인덱스 열 = 가짜 백엔드 UNIQUES", async () => {
    const rows = await t.q<{ tbl: string; cols: string[] }>(
      `select c.relname tbl, array(select a.attname from unnest(i.indkey) k join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k) cols
       from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and i.indisunique and not i.indisprimary`,
    );
    const sql = rows.filter((r) => !INTERNAL.has(r.tbl)).map((r) => `${r.tbl}(${[...r.cols].sort().join(",")})`).sort();
    const fake = Object.entries(UNIQUES)
      .flatMap(([tbl, list]) => (list ?? []).map((u) => `${tbl}(${[...u.cols].sort().join(",")})`))
      .sort();
    expect(fake).toEqual(sql);
  });
});
