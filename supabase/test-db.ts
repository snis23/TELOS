/**
 * SQL 테스트 공용 도구: supabase/telos.sql 을 PGlite(WASM Postgres)에서 실행한다.
 * Supabase 의 auth·storage·realtime 은 필요한 만큼만 흉내 낸다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const SETUP = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant usage on schema public to authenticated, anon;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`;

/** 지금 SQL 파일과, 버전별로 남겨 둔 옛 SQL 파일 */
export const SQL = {
  latest: () => readFileSync(resolve(process.cwd(), "supabase/telos.sql"), "utf8"),
  v1: () => readFileSync(resolve(process.cwd(), "supabase/fixtures/telos-v1.sql"), "utf8"),
  v2: () => readFileSync(resolve(process.cwd(), "supabase/fixtures/telos-v2.sql"), "utf8"),
};

export type TestDb = {
  db: PGlite;
  /** 로그인한 사용자로 한 문장 실행 (RLS 적용) */
  as<T = Record<string, unknown>>(uid: string, sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(uid: string, sql: string, params?: unknown[]): Promise<T>;
  /** 로그인한 사용자로 여러 문장 실행 */
  run(uid: string, sql: string): Promise<void>;
  /** 관리자 권한으로 조회 */
  q<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};

export async function createDb(users: readonly string[]): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SETUP);
  if (users.length) await db.exec(`insert into auth.users values ${users.map((u) => `('${u}')`).join(", ")};`);
  const login = (uid: string) => db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  const as: TestDb["as"] = async (uid, sql, params = []) => {
    await login(uid);
    try {
      return (await db.query(sql, params)).rows as never;
    } finally {
      await db.exec("reset role;");
    }
  };
  return {
    db,
    as,
    one: async (uid, sql, params) => (await as(uid, sql, params))[0] as never,
    run: async (uid, sql) => {
      await login(uid);
      try {
        await db.exec(sql);
      } finally {
        await db.exec("reset role;");
      }
    },
    q: async (sql, params = []) => (await db.query(sql, params)).rows as never,
  };
}

/** DB 구조 한눈에: 열, 제약, 인덱스, 함수, 정책, 트리거 (순서와 상관없이 비교하려고 정렬한다) */
export async function schemaSnapshot(t: TestDb): Promise<Record<string, string[]>> {
  const list = async (sql: string) => (await t.q<{ x: string }>(sql)).map((r) => r.x).sort();
  return {
    columns: await list(
      `select table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') x
       from information_schema.columns where table_schema = 'public'`,
    ),
    constraints: await list(
      `select conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid) x
       from pg_constraint where connamespace = 'public'::regnamespace`,
    ),
    indexes: await list(`select indexdef x from pg_indexes where schemaname = 'public'`),
    functions: await list(`select proname || '(' || pg_get_function_identity_arguments(oid) || ')' x from pg_proc where pronamespace = 'public'::regnamespace`),
    policies: await list(`select tablename || ' ' || policyname || ' ' || coalesce(qual, '') x from pg_policies where schemaname = 'public'`),
    triggers: await list(`select tgrelid::regclass || ' ' || tgname x from pg_trigger where not tgisinternal`),
  };
}
