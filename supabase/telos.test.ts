// @vitest-environment node
/**
 * supabase/telos.sql 을 PGlite(WASM Postgres)에서 실행해 보는 테스트.
 * 10.2 보관 작업: 대상 선택, 여러 번 실행해도 같은 결과 / RLS / 기본값 / 휴지통 / 백업 복원 / 버전별 올리기
 */
import { beforeAll, describe, expect, it } from "vitest";
import { SQL, createDb, schemaSnapshot, type TestDb } from "./test-db";

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
let t: TestDb;
let db: TestDb["db"];
const as: TestDb["as"] = (...args) => t.as(...args);
const one: TestDb["one"] = (...args) => t.one(...args);

beforeAll(async () => {
  t = await createDb([U1, U2]);
  db = t.db;
  const sql = SQL.latest();
  await db.exec(sql);
  await db.exec(sql); // 두 번 실행해도 안전해야 한다
  await as(U1, "select public.bootstrap_user()");
  await as(U1, "select public.bootstrap_user()");
  await as(U2, "select public.bootstrap_user()");
}, 60_000);

describe("기본값과 보안", () => {
  it("처음 로그인: 모의고사 과목 6개, 시간표 2종(37항목: 아침 자습·기숙사·주말 야간 자습), 공휴일. 두 번 불러도 같다", async () => {
    const r = await one<{ s: number; tt: number; sl: number; h: number }>(
      U1,
      "select (select count(*)::int from subjects) s, (select count(*)::int from timetables) tt, (select count(*)::int from timetable_slots) sl, (select count(*)::int from holidays) h",
    );
    expect(r).toEqual({ s: 6, tt: 2, sl: 37, h: 64 });
    expect((await as<{ name: string }>(U1, "select name from subjects where kind = 'mock' order by sort_order")).map((x) => x.name)).toEqual([
      "국어", "수학", "영어", "한국사", "통합사회", "통합과학",
    ]);
    // 평일 07:30~08:30 아침 자습 (입실·조례 없음), 주말 청소·아침 식사 없음
    expect(await one(U1, "select start_min, end_min, category from timetable_slots where name = '아침 자습'")).toEqual({ start_min: 90, end_min: 150, category: "study" });
    expect(await one(U1, "select count(*)::int c from timetable_slots s join timetables tt on tt.id = s.timetable_id where (tt.default_for = 'weekday' and s.name in ('입실', '조례')) or (tt.default_for = 'weekend' and s.name in ('청소', '아침 식사'))")).toEqual({ c: 0 });
    expect(await t.q("select version, name from schema_migrations")).toEqual([{ version: 3, name: "새로 설치" }]);
    expect(await one(U1, "select start_min, end_min from timetable_slots where name = '야자 1차시'")).toEqual({ start_min: 820, end_min: 900 });
    // 하루 기준 6시: 자정 = 1080, 새벽 2시 = 1200
    expect(await one(U1, "select start_min, end_min from timetable_slots where name = '기숙사 2차시'")).toEqual({ start_min: 1140, end_min: 1200 });
    expect(await one(U1, "select start_min, end_min from timetable_slots where name = '자습 6차시'")).toEqual({ start_min: 780, end_min: 840 });
  });

  it("모의고사 과목은 지워도 bootstrap 이 다시 채운다, 내신 과목은 보관하면 같은 이름을 다시 만들 수 있다", async () => {
    const sid = (await one<{ id: string }>(U1, "select id from subjects where name = '한국사'")).id;
    await as(U1, "select trash_item('subjects', $1)", [sid]);
    await as(U1, "select bootstrap_user()");
    expect(await one(U1, "select count(*)::int c from subjects where name = '한국사' and deleted_at is null")).toEqual({ c: 1 });
    // 지운 쪽을 되돌리면 이름이 겹친다
    await expect(as(U1, "select restore_batch($1)", [sid])).rejects.toMatchObject({ code: "23505" });

    await as(U1, "insert into subjects (name, color_key, kind, term) values ('화학Ⅰ', 'sky', 'school', '2-1')");
    await expect(as(U1, "insert into subjects (name, color_key, kind, term) values ('화학Ⅰ', 'sky', 'school', '2-1')")).rejects.toMatchObject({ code: "23505" });
    await as(U1, "update subjects set archived_at = now() where name = '화학Ⅰ'");
    await as(U1, "insert into subjects (name, color_key, kind, term) values ('화학Ⅰ', 'sky', 'school', '2-2')");
    // 모의고사 '수학' 과 내신 '수학' 은 함께 있을 수 있다
    await as(U1, "insert into subjects (name, color_key, kind) values ('수학', 'rose', 'school')");
    await expect(as(U1, "insert into subjects (name, color_key, kind, term) values ('x', 'rose', 'school', '4-1')")).rejects.toMatchObject({ code: "23514" });
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
    await expect(as(U1, "update profiles set reviewed_term = '2-3'")).rejects.toMatchObject({ code: "23514" });
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
    const sid = (await one<{ id: string }>(U1, "insert into subjects (name, color_key, kind) values ('통합사회1', 'sage', 'school') returning id")).id;
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

describe("시험 대비 로드맵", () => {
  it("로드맵 칸 하나는 할 일 하나로만, 시험을 지우면 시험 과목·칸이 한 묶음으로 휴지통에", async () => {
    const sid = (await one<{ id: string }>(U1, "select id from subjects where name = '수학' and kind = 'mock'")).id;
    const exam = (await one<{ id: string }>(U1, "insert into ddays (type, exam_kind, title, date) values ('exam', 'mock', '11월 모의고사', '2026-11-19') returning id")).id;
    await as(U1, "insert into exam_subjects (dday_id, subject_id, range_note) values ($1, $2, '수1 전 범위')", [exam, sid]);
    await expect(as(U1, "insert into exam_subjects (dday_id, subject_id) values ($1, $2)", [exam, sid])).rejects.toMatchObject({ code: "23505" });
    const item = (await one<{ id: string }>(U1, "insert into roadmap_items (dday_id, subject_id, study_date, content, round) values ($1, $2, '2026-11-03', '기출 21번', 2) returning id", [exam, sid])).id;
    await expect(as(U1, "insert into roadmap_items (dday_id, subject_id, study_date, content, round) values ($1, $2, '2026-11-03', 'x', 6)", [exam, sid])).rejects.toMatchObject({ code: "23514" });
    await as(U1, "insert into tasks (title, study_date, source, roadmap_item_id) values ('기출 21번', '2026-11-03', 'roadmap', $1)", [item]);
    await expect(as(U1, "insert into tasks (title, study_date, source, roadmap_item_id) values ('기출 21번', '2026-11-04', 'roadmap', $1)", [item])).rejects.toMatchObject({ code: "23505" });
    await as(U1, "select trash_item('ddays', $1)", [exam]);
    expect(await one(U1, "select (select count(*)::int from exam_subjects where delete_batch_id = $1) e, (select count(*)::int from roadmap_items where delete_batch_id = $1) r", [exam])).toEqual({ e: 1, r: 1 });
    await as(U1, "select restore_batch($1)", [exam]);
    expect(await one(U1, "select count(*)::int c from roadmap_items where dday_id = $1 and deleted_at is null", [exam])).toEqual({ c: 1 });
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
        ('${U2}', 'etc', '끝난 일정', current_date - 40), ('${U2}', 'exam', '다가오는 시험', current_date + 10),
        ('${U2}', 'exam', '끝난 시험', current_date - 40);
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
    // 끝난 시험은 시험 대비 기록으로 남는다
    expect(first).toMatchObject({ tasks: 1, ddays: "끝난 시험,다가오는 시험", notes: 1, photos: 0, pending: 2, old_sessions: 0, sessions: 1 });
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
    const tables = ["subjects", "units", "timetables", "timetable_slots", "holidays", "tasks", "wrong_notes", "wrong_note_photos", "daily_stats", "timer_sessions", "ddays", "exam_subjects", "roadmap_items", "reflections"];
    const backup: { app: string; version: number; profile: Record<string, unknown>; tables: Record<string, unknown[]> } = {
      app: "telos",
      version: 2,
      profile: { theme: "dark", entry_year: 2025, reviewed_term: "2-2" },
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
    expect(await one(U1, "select theme, entry_year, reviewed_term from profiles")).toEqual({ theme: "dark", entry_year: 2025, reviewed_term: "2-2" });
    expect((await one<{ c: number }>(U1, "select count(*)::int c from pending_file_deletions")).c).toBe(pendingBefore);
    await expect(as(U1, "select restore_backup('{\"app\":\"x\"}'::jsonb)")).rejects.toMatchObject({ code: "22023" });
  });
});

describe("버전별 올리기 (3장)", () => {
  const U = "33333333-3333-3333-3333-333333333333";
  let fresh: Record<string, string[]>;

  /** 옛 SQL 로 DB 를 만들고 준비한 뒤, 지금 SQL 을 두 번 실행한다 */
  async function upgradeFrom(old: string, prepare: (x: TestDb) => Promise<void>): Promise<TestDb> {
    const x = await createDb([U]);
    await x.db.exec(old);
    await x.as(U, "select public.bootstrap_user()");
    await prepare(x);
    await x.db.exec(SQL.latest());
    await x.db.exec(SQL.latest());
    await x.as(U, "select public.bootstrap_user()");
    return x;
  }

  beforeAll(async () => {
    const x = await createDb([]);
    await x.db.exec(SQL.latest());
    fresh = await schemaSnapshot(x);
  }, 60_000);

  it("버전 1(Phase 1~6) → 최신: 데이터를 옮기고, 새로 설치한 DB 와 구조가 같다", async () => {
    const x = await upgradeFrom(SQL.v1(), (y) =>
      y.run(
        U,
        `insert into ddays (type, title, date) values ('exam', '기말', '2026-12-08');
         insert into range_items (dday_id, subject_id, name, start_no, end_no) select d.id, s.id, '문제집', 10, 80 from ddays d, subjects s where s.name = '수학';
         insert into exam_subject_dates (dday_id, subject_id, date) select d.id, s.id, '2026-12-09' from ddays d, subjects s where s.name = '국어';
         insert into reflections (study_date, good, bad, tomorrow, condition) values ('2026-11-01', '잘함', '', '내일', 4);
         insert into tasks (title, study_date, source) values ('범위 할 일', '2026-11-02', 'range');`,
      ),
    );
    expect((await x.q<{ version: number }>("select version from schema_migrations order by 1")).map((r) => r.version)).toEqual([1, 2, 3]);
    expect((await x.q<{ n: string; a: boolean }>("select name n, archived_at is not null a from subjects where kind = 'mock' order by archived_at nulls first, sort_order")).map((r) => `${r.n}${r.a ? ":보관" : ""}`)).toEqual([
      "국어", "수학", "영어", "한국사", "통합사회", "통합과학", "탐구1:보관", "탐구2:보관",
    ]);
    expect(await x.q("select s.name, e.exam_date::text d, e.range_note from exam_subjects e join subjects s on s.id = e.subject_id order by s.name")).toEqual([
      { name: "국어", d: "2026-12-09", range_note: null },
      { name: "수학", d: null, range_note: "문제집 10~80" },
    ]);
    expect(await x.q("select comment from reflections")).toEqual([{ comment: "잘함\n내일" }]);
    expect(await x.q("select source from tasks")).toEqual([{ source: "manual" }]);
    expect(await schemaSnapshot(x)).toEqual(fresh);
  }, 120_000);

  it("버전 2(1차 수정) → 최신: 시간표·과목 순서를 바꾸고, 새로 설치한 DB 와 구조가 같다. 다시 실행해도 그대로", async () => {
    const x = await upgradeFrom(SQL.v2(), (y) =>
      y.run(U, "update tasks set slot_id = null; insert into tasks (title, study_date, slot_id) select '조례 때 할 일', '2026-11-03', id from timetable_slots where name = '조례';"),
    );
    expect((await x.q<{ version: number }>("select version from schema_migrations order by 1")).map((r) => r.version)).toEqual([2, 3]);
    expect((await x.q<{ name: string }>("select name from subjects where kind = 'mock' order by sort_order")).map((r) => r.name)).toEqual([
      "국어", "수학", "영어", "한국사", "통합사회", "통합과학",
    ]);
    const slots = () =>
      x.q("select tt.default_for f, s.name, s.start_min, s.end_min from timetable_slots s join timetables tt on tt.id = s.timetable_id where s.name in ('입실', '조례', '아침 자습', '청소', '아침 식사') order by 1, 3");
    const after = await slots();
    expect(after).toEqual([
      { f: "weekday", name: "아침 자습", start_min: 90, end_min: 150 },
      { f: "weekday", name: "청소", start_min: 620, end_min: 640 },
    ]);
    // 지운 차시에 배정했던 할 일은 남고 배정만 풀린다
    expect(await x.q("select title, slot_id from tasks")).toEqual([{ title: "조례 때 할 일", slot_id: null }]);
    expect(await schemaSnapshot(x)).toEqual(fresh);
    await x.db.exec(SQL.latest());
    expect(await slots()).toEqual(after);
  }, 120_000);
});
