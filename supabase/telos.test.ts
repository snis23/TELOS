// @vitest-environment node
/**
 * supabase/telos.sql 을 PGlite(WASM Postgres)에서 실행해 보는 테스트.
 * Supabase 의 auth·storage·realtime 은 필요한 만큼만 흉내 낸다.
 * 10.2 보관 작업: 대상 선택, 여러 번 실행해도 같은 결과 / RLS / 기본값 / 휴지통 / 백업 복원
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
let db: PGlite;

async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}
const one = async <T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) => (await as<T>(uid, sql, params))[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
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
  `);
  const sql = readFileSync(resolve(process.cwd(), "supabase/telos.sql"), "utf8");
  await db.exec(sql);
  await db.exec(sql); // 두 번 실행해도 안전해야 한다
  await db.exec(`insert into auth.users values ('${U1}'), ('${U2}');`);
  await as(U1, "select public.bootstrap_user()");
  await as(U1, "select public.bootstrap_user()");
  await as(U2, "select public.bootstrap_user()");
}, 60_000);

describe("기본값과 보안", () => {
  it("처음 로그인: 과목 8개, 시간표 2종(31항목), 공휴일. 두 번 불러도 같다", async () => {
    const r = await one<{ s: number; tt: number; sl: number; h: number }>(
      U1,
      "select (select count(*)::int from subjects) s, (select count(*)::int from timetables) tt, (select count(*)::int from timetable_slots) sl, (select count(*)::int from holidays) h",
    );
    expect(r).toEqual({ s: 8, tt: 2, sl: 31, h: 64 });
    expect(await one(U1, "select start_min, end_min from timetable_slots where name = '야자 1차시'")).toEqual({ start_min: 820, end_min: 900 });
  });

  it("RLS: 다른 사용자의 행은 보이지도 바뀌지도 않는다", async () => {
    const sid = (await one<{ id: string }>(U1, "select id from subjects where name = '수학'")).id;
    expect((await as(U2, "select * from subjects where id = $1", [sid])).length).toBe(0);
    expect((await as(U2, "update subjects set name = 'x' where id = $1 returning id", [sid])).length).toBe(0);
    await expect(as(U2, `insert into tasks (user_id, title, study_date) values ('${U1}', 'x', '2026-11-02')`)).rejects.toMatchObject({ code: "42501" });
  });

  it("제약: 켜진 타이머 하나, 오답 사진 5장, 내신 오답은 단원 필수", async () => {
    await as(U1, "insert into timer_sessions (kind, started_at) values ('nap', now())");
    await expect(as(U1, "insert into timer_sessions (kind, started_at) values ('nap', now())")).rejects.toMatchObject({ code: "23505" });
    await as(U1, "update timer_sessions set ended_at = now() where ended_at is null");
    const sid = (await one<{ id: string }>(U1, "select id from subjects where name = '국어'")).id;
    await expect(as(U1, "insert into wrong_notes (kind, subject_id, reason) values ('school', $1, 'concept')", [sid])).rejects.toMatchObject({ code: "23514" });
    await expect(as(U1, "update profiles set day_start_hour = 13")).rejects.toMatchObject({ code: "23514" });
    await expect(as(U1, "select run_daily_maintenance()")).rejects.toMatchObject({ code: "42501" });
  });
});

describe("하루 통계", () => {
  it("하루 경계를 넘긴 기록은 두 날짜로 나눠 센다", async () => {
    const sid = (await one<{ id: string }>(U1, "select id from subjects where name = '수학'")).id;
    await as(U1, "insert into timer_sessions (kind, subject_id, started_at, ended_at) values ('study', $1, '2026-10-11 05:30+09', '2026-10-11 06:30+09')", [sid]);
    await as(U1, "select refresh_daily_stats('2026-10-10', '2026-10-11')");
    const rows = await as<{ d: string; s: number }>(U1, "select study_date::text d, study_seconds s from daily_stats where subject_id = $1 and study_date between '2026-10-10' and '2026-10-11' order by d", [sid]);
    expect(rows).toEqual([
      { d: "2026-10-10", s: 1800 },
      { d: "2026-10-11", s: 1800 },
    ]);
  });
});

describe("휴지통과 미루기", () => {
  it("과목 삭제는 오답·단원을 한 묶음으로, 복원도 함께", async () => {
    const sid = (await one<{ id: string }>(U1, "select id from subjects where name = '사회'")).id;
    const unit = (await one<{ id: string }>(U1, "insert into units (subject_id, name) values ($1, '정치') returning id", [sid])).id;
    await as(U1, "insert into wrong_notes (kind, subject_id, unit_id, reason) values ('school', $1, $2, 'slip')", [sid, unit]);
    await as(U1, "select trash_item('subjects', $1)", [sid]);
    expect(await one(U1, "select (select count(*)::int from wrong_notes where delete_batch_id = $1) n, (select count(*)::int from units where delete_batch_id = $1) u", [sid])).toEqual({ n: 1, u: 1 });
    await as(U1, "select restore_batch($1)", [sid]);
    expect(await one(U1, "select count(*)::int c from wrong_notes where subject_id = $1 and deleted_at is null", [sid])).toEqual({ c: 1 });
  });

  it("넘기기와 되돌리기", async () => {
    const t = (await one<{ id: string }>(U1, "insert into tasks (title, study_date) values ('넘길 일', '2026-10-20') returning id")).id;
    expect((await as(U1, "select * from defer_tasks(array[$1]::uuid[], '2026-10-21')", [t])).length).toBe(1);
    expect(await one(U1, "select study_date::text, deferred_count from tasks where id = $1", [t])).toEqual({ study_date: "2026-10-21", deferred_count: 1 });
    await as(U1, "select undefer_tasks(array[$1]::uuid[])", [t]);
    expect(await one(U1, "select study_date::text, deferred_count from tasks where id = $1", [t])).toEqual({ study_date: "2026-10-20", deferred_count: 0 });
  });
});

describe("매일 자동 작업 (9.3)", () => {
  it("대상 선택: 30일 지난 할 일, 끝난 D-day, 7일 지난 휴지통(사진 파일은 대기열로), 3개월 지난 기록", async () => {
    const sid = (await one<{ id: string }>(U2, "select id from subjects where name = '수학'")).id;
    const unit = (await one<{ id: string }>(U2, "insert into units (subject_id, name) values ($1, '지수') returning id", [sid])).id;
    await db.exec(`
      insert into tasks (user_id, title, study_date) values
        ('${U2}', '오래된 할 일', current_date - 40), ('${U2}', '최근 할 일', current_date - 3);
      insert into ddays (user_id, type, title, date) values
        ('${U2}', 'etc', '끝난 일정', current_date - 40), ('${U2}', 'exam', '다가오는 시험', current_date + 10);
      insert into timer_sessions (user_id, kind, subject_id, started_at, ended_at) values
        ('${U2}', 'study', '${sid}', now() - interval '100 days', now() - interval '100 days' + interval '1 hour'),
        ('${U2}', 'study', '${sid}', now() - interval '10 days', now() - interval '10 days' + interval '1 hour');
    `);
    const note = (await one<{ id: string }>(U2, "insert into wrong_notes (kind, subject_id, unit_id, reason) values ('school', $1, $2, 'time') returning id", [sid, unit])).id;
    await as(U2, `insert into wrong_note_photos (note_id, storage_path) values ($1::uuid, '${U2}/' || $1::text || '/a.jpg'), ($1::uuid, '${U2}/' || $1::text || '/b.jpg')`, [note]);
    await as(U2, "select trash_item('wrong_notes', $1)", [note]);
    await db.exec(`update wrong_notes set deleted_at = now() - interval '8 days' where id = '${note}'`);
    const keep = (await one<{ id: string }>(U2, "insert into wrong_notes (kind, subject_id, unit_id, reason) values ('school', $1, $2, 'time') returning id", [sid, unit])).id;
    await as(U2, "select trash_item('wrong_notes', $1)", [keep]); // 방금 지운 것은 남는다

    await db.exec("select public.run_daily_maintenance()");

    const snapshot = async () =>
      one(
        U2,
        `select
          (select count(*)::int from tasks) tasks,
          (select string_agg(title, ',' order by title) from ddays) ddays,
          (select count(*)::int from wrong_notes) notes,
          (select count(*)::int from wrong_note_photos) photos,
          (select count(*)::int from pending_file_deletions) pending,
          (select count(*)::int from timer_sessions where started_at < now() - interval '90 days') old_sessions,
          (select count(*)::int from timer_sessions) sessions,
          (select coalesce(sum(study_seconds), 0)::int from daily_stats) stat_seconds`,
      );
    const first = await snapshot();
    expect(first).toMatchObject({ tasks: 1, ddays: "다가오는 시험", notes: 1, photos: 0, pending: 2, old_sessions: 0, sessions: 1 });
    // 3개월 지난 기록은 지우기 전에 그날 통계를 만들어 둔다
    expect(Number(first.stat_seconds)).toBeGreaterThanOrEqual(3600);

    // 여러 번 실행해도 같은 결과
    await db.exec("select public.run_daily_maintenance()");
    await db.exec("select public.run_daily_maintenance()");
    expect(await snapshot()).toEqual(first);
    const runs = (await db.query<{ ok: boolean }>("select ok from maintenance_runs order by id")).rows;
    expect(runs.every((r) => r.ok)).toBe(true);
  });
});

describe("백업 복원 (9.5)", () => {
  it("restore_backup: 지금 기록을 백업 내용으로 바꾸고, 사진 파일 삭제는 예약하지 않는다", async () => {
    const tables = ["subjects", "units", "timetables", "timetable_slots", "holidays", "tasks", "wrong_notes", "wrong_note_photos", "daily_stats", "timer_sessions", "ddays"];
    const backup: { app: string; version: number; profile: Record<string, unknown>; tables: Record<string, unknown[]> } = {
      app: "telos",
      version: 1,
      profile: { theme: "dark" },
      tables: {},
    };
    for (const t of tables) backup.tables[t] = await as(U1, `select * from ${t}`);
    const count = () => one(U1, "select (select count(*)::int from subjects) s, (select count(*)::int from tasks) t, (select count(*)::int from holidays) h");
    const before = await count();
    await as(U1, "insert into subjects (name, color_key) values ('복원 뒤 사라질 과목', 'rose')");
    await as(U1, "delete from tasks");
    const pendingBefore = (await one<{ c: number }>(U1, "select count(*)::int c from pending_file_deletions")).c;
    await as(U1, "select restore_backup($1::jsonb)", [JSON.stringify(backup)]);
    expect(await count()).toEqual(before);
    expect(await one(U1, "select theme from profiles")).toEqual({ theme: "dark" });
    expect((await one<{ c: number }>(U1, "select count(*)::int c from pending_file_deletions")).c).toBe(pendingBefore);
    await expect(as(U1, "select restore_backup('{\"app\":\"x\"}'::jsonb)")).rejects.toMatchObject({ code: "22023" });
  });
});
