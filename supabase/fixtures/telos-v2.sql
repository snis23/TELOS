-- 테스트 전용: 2차 수정 이전(1차 수정, 버전 2) telos.sql 그대로.
-- supabase/telos.test.ts 가 이 파일로 버전 2 DB 를 만든 뒤 새 telos.sql 로 올리는 과정을 확인한다. 실행하지 마세요.

-- ============================================================================
-- Telos 데이터베이스 전체 설정 (Phase 1~6 + 1차 수정)
--
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여 넣고 Run.
--   - 여러 번 실행해도 안전하다. 이미 있는 테이블·데이터는 그대로 두고, 함수·정책은 새로 만든다.
--   - 이전 버전으로 만든 데이터베이스에 실행하면 2.99 의 업그레이드가 새 구조로 바꾼다
--     (성적·생기부·목표 로드맵·범위 분배·회독 표는 지우고, 과목은 모의고사/내신으로 나눈다).
--   - 매일 자동 작업(pg_cron)은 확장을 먼저 켜야 등록된다. 꺼져 있으면 맨 아래에서 안내만 하고 넘어간다.
--
-- 규칙 (spec.md 9장)
--   - 모든 테이블: id(uuid), user_id(기본값 auth.uid()), created_at, updated_at, RLS(user_id = auth.uid())
--   - 사용자가 지우는 것은 deleted_at 을 채운다(휴지통). 7일 뒤 완전 삭제.
--   - delete_batch_id: 함께 지운 묶음. 묶음의 첫 행은 delete_batch_id = id 이다.
--   - 시각은 timestamptz(UTC), 날짜 구분은 study_date(하루 기준 시각 적용, 한국 시간)
--   - start_min, end_min: 하루 기준 시각부터 센 분(0~1440), 10의 배수
-- ============================================================================


-- ============================================================================
-- 1. 공통 함수
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ============================================================================
-- 2. 테이블
-- ============================================================================

-- 2.1 profiles: 사용자당 1행 ---------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  theme text not null default 'system',
  day_start_hour smallint not null default 6,
  -- 학기 기간 (MM-DD). 2학기 끝 02-29 는 "2월 말일"로 읽는다
  sem1_start text not null default '03-01',
  sem1_end text not null default '07-31',
  sem2_start text not null default '08-01',
  sem2_end text not null default '02-29',
  -- 입학 연도 (학년 계산용) / 마지막으로 내신 과목을 정리한 학기 ("2-1" = 2학년 1학기)
  entry_year smallint,
  reviewed_term text,
  sidebar_collapsed boolean not null default false,
  last_backup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id),
  constraint profiles_theme_check check (theme in ('light', 'dark', 'system')),
  constraint profiles_day_start_hour_check check (day_start_hour between 0 and 12),
  constraint profiles_entry_year_check check (entry_year is null or entry_year between 2000 and 2100),
  constraint profiles_reviewed_term_check check (reviewed_term is null or reviewed_term ~ '^[1-3]-[12]$'),
  constraint profiles_semester_check check (
    sem1_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and sem1_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and sem2_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and sem2_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  )
);

-- 2.2 subjects: 과목 ----------------------------------------------------------
--   kind = 'mock': 모의고사 과목 (국어·수학·영어·한국사·통합과학·통합사회, 고정)
--   kind = 'school': 내신 과목. term 은 처음 배운 학기("1-2"), 학기가 끝나면 보관(archived_at)한다.
--   보관한 과목은 고르는 목록에서만 빠지고 기록(오답·공부 시간·로드맵)은 그대로 남는다.
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color_key text not null,
  sort_order integer not null default 0,
  kind text not null default 'school',
  term text,
  archived_at timestamptz,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_name_check check (name = btrim(name) and char_length(name) between 1 and 20),
  constraint subjects_color_key_check check (
    color_key in ('rose', 'periwinkle', 'mint', 'butter', 'lavender', 'peach', 'sky', 'sage')
  ),
  constraint subjects_kind_check check (kind in ('mock', 'school')),
  constraint subjects_term_check check (term is null or term ~ '^[1-3]-[12]$')
);

-- 2.3 units: 과목별 단원 (6.1) -------------------------------------------------
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  status text not null default 'todo',
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_name_check check (name = btrim(name) and char_length(name) between 1 and 40),
  constraint units_status_check check (status in ('todo', 'doing', 'done'))
);
create index if not exists units_subject_idx on public.units (subject_id);

-- 2.4 timetables / timetable_slots: 학교 시간표 (5.10) -------------------------
create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  default_for text not null default 'none',
  sort_order integer not null default 0,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetables_name_check check (name = btrim(name) and char_length(name) between 1 and 20),
  constraint timetables_default_for_check check (default_for in ('weekday', 'weekend', 'none'))
);
-- 평일 기본, 주말·공휴일 기본은 각각 하나
create unique index if not exists timetables_default_key
  on public.timetables (user_id, default_for)
  where default_for <> 'none' and deleted_at is null;

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  timetable_id uuid not null references public.timetables (id) on delete cascade,
  name text not null,
  category text not null,
  start_min smallint not null,
  end_min smallint not null,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_slots_name_check check (name = btrim(name) and char_length(name) between 1 and 20),
  constraint timetable_slots_category_check check (category in ('class', 'study', 'meal', 'life')),
  constraint timetable_slots_time_check check (
    start_min >= 0 and end_min <= 1440 and start_min < end_min
    and start_min % 10 = 0 and end_min % 10 = 0
  )
);
create index if not exists timetable_slots_timetable_idx on public.timetable_slots (timetable_id);

-- 2.5 holidays / date_timetables ----------------------------------------------
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  name text not null,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint holidays_name_check check (name = btrim(name) and char_length(name) between 1 and 30)
);
create unique index if not exists holidays_date_key on public.holidays (user_id, date) where deleted_at is null;

create table if not exists public.date_timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  timetable_id uuid not null references public.timetables (id) on delete cascade,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists date_timetables_date_key on public.date_timetables (user_id, date) where deleted_at is null;

-- 2.6 recurrences: 반복 할 일 규칙 (5.6) ---------------------------------------
--   rule: {"type":"daily"} | {"type":"weekdays","days":[1..7]} | {"type":"biweekly","days":[1..7]}
--   (1 = 월요일 … 7 = 일요일, 격주는 start_date 가 있는 주부터 2주마다)
create table if not exists public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  est_minutes smallint,
  rule jsonb not null,
  start_date date not null,
  end_date date,
  default_slot_name text,
  default_start_min smallint,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrences_title_check check (title = btrim(title) and char_length(title) between 1 and 60),
  constraint recurrences_est_check check (est_minutes is null or est_minutes between 5 and 600),
  constraint recurrences_rule_check check (
    rule ->> 'type' in ('daily', 'weekdays', 'biweekly')
    and (rule ->> 'type' = 'daily' or jsonb_typeof(rule -> 'days') = 'array')
  ),
  constraint recurrences_dates_check check (end_date is null or end_date >= start_date),
  constraint recurrences_start_min_check check (
    default_start_min is null or (default_start_min between 0 and 1430 and default_start_min % 10 = 0)
  )
);

-- 2.7 ddays / exam_subjects / roadmap_items: 일정과 시험 대비 로드맵 (5.3, 6장) ----
--   시험(type = 'exam')은 하나가 "시험 대비 카테고리"다. exam_kind 로 과목 목록을 나눈다
--   (school: 이번 학기 내신 과목, mock: 모의고사 과목, other: 모든 과목).
--   끝난 시험도 기록 화면에 남도록 지우지 않는다.
create table if not exists public.ddays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  date date not null,
  subject_id uuid references public.subjects (id) on delete set null,
  pinned boolean not null default false,
  pin_order integer not null default 0,
  status text not null default 'todo',
  prep_percent smallint,
  perf_kind text,
  memo text,
  exam_kind text,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ddays_type_check check (type in ('exam', 'performance', 'etc')),
  constraint ddays_title_check check (title = btrim(title) and char_length(title) between 1 and 60),
  constraint ddays_status_check check (status in ('todo', 'doing', 'done')),
  constraint ddays_prep_check check (prep_percent is null or prep_percent between 0 and 100),
  constraint ddays_perf_kind_check check (
    perf_kind is null or perf_kind in ('report', 'presentation', 'experiment', 'writing', 'debate', 'etc')
  ),
  constraint ddays_memo_check check (memo is null or char_length(memo) <= 500),
  constraint ddays_exam_kind_check check (exam_kind is null or exam_kind in ('school', 'mock', 'other'))
);

-- 시험에 들어가는 과목: 과목별 시험 날짜(없으면 시험 첫날)와 시험 범위 메모
create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dday_id uuid not null references public.ddays (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  exam_date date,
  range_note text,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_subjects_range_check check (range_note is null or char_length(range_note) <= 500)
);
create unique index if not exists exam_subjects_key
  on public.exam_subjects (dday_id, subject_id) where deleted_at is null;

-- 로드맵 달력의 한 칸: 날짜 + 과목 + 무슨 공부. round 는 회독(1~5회독, 없으면 null)
create table if not exists public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dday_id uuid not null references public.ddays (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  study_date date not null,
  content text not null,
  round smallint,
  done_at timestamptz,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roadmap_items_content_check check (content = btrim(content) and char_length(content) between 1 and 80),
  constraint roadmap_items_round_check check (round is null or round between 1 and 5)
);
create index if not exists roadmap_items_dday_date_idx on public.roadmap_items (dday_id, study_date);

-- 2.8 tasks: 할 일 (5.6) -------------------------------------------------------
--   source = 'roadmap' 이면 로드맵 칸에서 골라 넣은 할 일. 체크하면 로드맵 칸도 끝낸 것으로 바뀐다.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  est_minutes smallint,
  study_date date not null,
  sort_order integer not null default 0,
  done_at timestamptz,
  deferred_count smallint not null default 0,
  missed_streak smallint not null default 0,
  must_do boolean not null default false,
  start_min smallint,
  end_min smallint,
  slot_id uuid references public.timetable_slots (id) on delete set null,
  source text not null default 'manual',
  recurrence_id uuid references public.recurrences (id) on delete set null,
  roadmap_item_id uuid references public.roadmap_items (id) on delete set null,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_check check (title = btrim(title) and char_length(title) between 1 and 80),
  constraint tasks_est_check check (est_minutes is null or est_minutes between 5 and 600),
  constraint tasks_counts_check check (deferred_count >= 0 and missed_streak >= 0),
  constraint tasks_source_check check (source in ('manual', 'recurrence', 'roadmap')),
  constraint tasks_block_check check (
    (start_min is null and end_min is null)
    or (start_min >= 0 and end_min <= 1440 and start_min < end_min and start_min % 10 = 0 and end_min % 10 = 0)
  ),
  -- 같은 반복·같은 날짜는 하나만 (지운 것 포함: "이번만 삭제"한 날은 다시 만들지 않는다)
  constraint tasks_recurrence_date_key unique (recurrence_id, study_date)
);
create index if not exists tasks_user_date_idx on public.tasks (user_id, study_date);

-- 2.9 task_deferrals: 미룬 기록 (5.7, 8.1 실행률·미루기 분석) ----------------
create table if not exists public.task_deferrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  subject_id uuid,
  title text not null,
  from_date date not null,
  to_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_deferrals_user_from_idx on public.task_deferrals (user_id, from_date);

-- 2.10 timer_sessions: 공부·쪽잠 기록 (5.4, 5.5) -------------------------------
create table if not exists public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  subject_id uuid references public.subjects (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  device_label text,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timer_sessions_kind_check check (kind in ('study', 'nap')),
  constraint timer_sessions_nap_subject_check check (kind = 'study' or subject_id is null),
  constraint timer_sessions_time_check check (ended_at is null or ended_at >= started_at)
);
-- 켜진 타이머는 사용자당 하나
create unique index if not exists timer_sessions_one_active
  on public.timer_sessions (user_id) where ended_at is null and deleted_at is null;
create index if not exists timer_sessions_user_started_idx on public.timer_sessions (user_id, started_at);

-- 2.11 daily_stats: 하루 합계 (계속 보관) --------------------------------------
--   subject_id 가 있는 행: 그 과목 순공 / subject_id 가 null 인 행: 쪽잠·할 일 합계
--   과목을 완전히 지워도 통계는 남도록 외래 키를 걸지 않는다
create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  study_date date not null,
  subject_id uuid,
  study_seconds integer not null default 0,
  nap_seconds integer not null default 0,
  nap_count integer not null default 0,
  planned_tasks integer not null default 0,
  done_tasks integer not null default 0,
  deferred_events integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_stats_values_check check (
    study_seconds >= 0 and nap_seconds >= 0 and nap_count >= 0
    and planned_tasks >= 0 and done_tasks >= 0 and deferred_events >= 0
  ),
  constraint daily_stats_key unique nulls not distinct (user_id, study_date, subject_id)
);

-- 2.12 reflections: 하루 코멘트 (5.8) ------------------------------------------
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  study_date date not null,
  comment text not null default '',
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reflections_comment_check check (char_length(comment) <= 500)
);
create unique index if not exists reflections_date_key on public.reflections (user_id, study_date) where deleted_at is null;

-- 2.13 mock_rounds: 모의고사 회차 (8.3) ----------------------------------------
create table if not exists public.mock_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year smallint not null,
  month smallint not null,
  name text not null,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_rounds_year_check check (year between 2000 and 2100),
  constraint mock_rounds_month_check check (month between 1 and 12),
  constraint mock_rounds_name_check check (name = btrim(name) and char_length(name) between 1 and 40)
);
create unique index if not exists mock_rounds_key on public.mock_rounds (user_id, year, month, name) where deleted_at is null;

-- 2.14 wrong_notes / wrong_note_photos: 오답노트 (7장) -------------------------
create table if not exists public.wrong_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  unit_id uuid references public.units (id) on delete cascade,
  mock_round_id uuid references public.mock_rounds (id) on delete cascade,
  source text,
  question_no smallint,
  points smallint,
  reason text not null,
  memo text,
  solved_at timestamptz,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrong_notes_kind_check check (kind in ('school', 'mock')),
  -- 내신이면 단원 필수, 모의고사면 회차 필수
  constraint wrong_notes_kind_ref_check check (
    (kind = 'school' and unit_id is not null and mock_round_id is null and points is null and question_no is null)
    or (kind = 'mock' and mock_round_id is not null)
  ),
  constraint wrong_notes_source_check check (source is null or char_length(source) <= 60),
  constraint wrong_notes_question_check check (question_no is null or question_no between 1 and 45),
  constraint wrong_notes_points_check check (points is null or points in (2, 3, 4)),
  constraint wrong_notes_reason_check check (reason in ('concept', 'slip', 'time')),
  constraint wrong_notes_memo_check check (memo is null or char_length(memo) <= 500)
);
create index if not exists wrong_notes_subject_idx on public.wrong_notes (subject_id);

create table if not exists public.wrong_note_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references public.wrong_notes (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  width integer,
  height integer,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrong_note_photos_path_key unique (storage_path)
);
create index if not exists wrong_note_photos_note_idx on public.wrong_note_photos (note_id);

-- 2.15 flash_decks / flash_cards: 암기 카드 (7.4) ------------------------------
create table if not exists public.flash_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  subject_id uuid references public.subjects (id) on delete set null,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flash_decks_title_check check (title = btrim(title) and char_length(title) between 1 and 60)
);

create table if not exists public.flash_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id uuid not null references public.flash_decks (id) on delete cascade,
  front text not null,
  back text not null,
  known boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flash_cards_front_check check (char_length(btrim(front)) between 1 and 200),
  constraint flash_cards_back_check check (char_length(btrim(back)) between 1 and 500)
);
create index if not exists flash_cards_deck_idx on public.flash_cards (deck_id);

-- 2.16 pending_file_deletions: 지울 사진 파일 (9.3) ----------------------------
create table if not exists public.pending_file_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.17 maintenance_runs: 매일 자동 작업 기록 (9.3) -----------------------------
create table if not exists public.maintenance_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  detail text
);


-- ============================================================================
-- 2.99 이전 버전에서 올리기
--   처음 설치하면 아무것도 바뀌지 않는다. 이전 버전 DB 에 실행하면 새 구조로 바꾼다.
--   여러 번 실행해도 결과가 같다. 데이터를 옮기는 부분은 옛 열(profiles.auto_range_tasks)이
--   남아 있을 때 한 번만 한다.
-- ============================================================================

-- (1) 새 열
alter table public.profiles add column if not exists entry_year smallint;
alter table public.profiles add column if not exists reviewed_term text;
alter table public.subjects add column if not exists kind text not null default 'school';
alter table public.subjects add column if not exists term text;
alter table public.subjects add column if not exists archived_at timestamptz;
alter table public.ddays add column if not exists exam_kind text;
alter table public.tasks add column if not exists roadmap_item_id uuid references public.roadmap_items (id) on delete set null;
alter table public.reflections add column if not exists comment text not null default '';

-- (2) 옛 데이터 옮기기 (한 번만)
do $$
declare
  h integer;
  r record;
  tid uuid;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'auto_range_tasks'
  ) then
    return;
  end if;

  -- 과목: 과학·사회 → 통합과학·통합사회, 모의고사 6과목은 mock, 탐구1·2는 보관, 나머지는 내신
  update public.subjects s set name = '통합과학'
  where s.name = '과학' and s.deleted_at is null
    and not exists (select 1 from public.subjects o where o.user_id = s.user_id and o.name = '통합과학' and o.deleted_at is null);
  update public.subjects s set name = '통합사회'
  where s.name = '사회' and s.deleted_at is null
    and not exists (select 1 from public.subjects o where o.user_id = s.user_id and o.name = '통합사회' and o.deleted_at is null);
  update public.subjects set kind = 'mock'
  where name in ('국어', '수학', '영어', '한국사', '통합과학', '통합사회');
  update public.subjects set kind = 'mock', archived_at = now()
  where name in ('탐구1', '탐구2') and archived_at is null;

  -- 하루 회고 세 칸 → 하루 코멘트 한 칸
  update public.reflections
  set comment = left(concat_ws(E'\n', nullif(good, ''), nullif(bad, ''), nullif(tomorrow, '')), 500)
  where comment = '';

  -- 시험: 범위 분배 항목 → 시험 과목의 범위 메모, 과목별 시험 날짜 → 시험 과목
  update public.ddays set exam_kind = 'other' where type = 'exam' and exam_kind is null;
  if to_regclass('public.range_items') is not null then
    insert into public.exam_subjects (user_id, dday_id, subject_id, range_note)
    select user_id, dday_id, subject_id,
           left(string_agg(name || ' ' || start_no || '~' || end_no, ', ' order by sort_order), 500)
    from public.range_items
    where deleted_at is null
    group by user_id, dday_id, subject_id
    on conflict do nothing;
  end if;
  if to_regclass('public.exam_subject_dates') is not null then
    update public.exam_subjects e set exam_date = d.date
    from public.exam_subject_dates d
    where d.deleted_at is null and d.dday_id = e.dday_id and d.subject_id = e.subject_id;
    insert into public.exam_subjects (user_id, dday_id, subject_id, exam_date)
    select user_id, dday_id, subject_id, date from public.exam_subject_dates where deleted_at is null
    on conflict do nothing;
  end if;

  -- 할 일: 범위·목표에서 온 할 일은 일반 할 일로
  update public.tasks set source = 'manual' where source not in ('manual', 'recurrence', 'roadmap');

  -- 시간표: 평일 기숙사 1·2차시, 주말 19시부터 2시까지 한 시간 단위 자습
  for r in select user_id, day_start_hour from public.profiles loop
    h := r.day_start_hour;
    select id into tid from public.timetables
    where user_id = r.user_id and default_for = 'weekday' and deleted_at is null;
    if tid is not null then
      insert into public.timetable_slots (user_id, timetable_id, name, category, start_min, end_min)
      select r.user_id, tid, s.name, 'study',
             ((s.start_clock - h * 60) + 1440) % 1440,
             ((s.start_clock - h * 60) + 1440) % 1440 + 60
      from (values ('기숙사 1차시', 0), ('기숙사 2차시', 60)) as s (name, start_clock)
      where not exists (
        select 1 from public.timetable_slots x where x.timetable_id = tid and x.name = s.name and x.deleted_at is null
      );
    end if;
    tid := null;
    select id into tid from public.timetables
    where user_id = r.user_id and default_for = 'weekend' and deleted_at is null;
    if tid is not null then
      insert into public.timetable_slots (user_id, timetable_id, name, category, start_min, end_min)
      select r.user_id, tid, s.name, 'study',
             ((s.start_clock - h * 60) + 1440) % 1440,
             ((s.start_clock - h * 60) + 1440) % 1440 + 60
      from (values
        ('자습 6차시', 1140), ('자습 7차시', 1200), ('자습 8차시', 1260), ('자습 9차시', 1320),
        ('자습 10차시', 1380), ('자습 11차시', 0), ('자습 12차시', 60)
      ) as s (name, start_clock)
      where not exists (
        select 1 from public.timetable_slots x where x.timetable_id = tid and x.name = s.name and x.deleted_at is null
      );
    end if;
    tid := null;
  end loop;
end;
$$;

-- (3) 옛 열·표 지우기, 제약 다시 걸기
alter table public.profiles drop column if exists auto_range_tasks;
alter table public.profiles drop constraint if exists profiles_entry_year_check;
alter table public.profiles add constraint profiles_entry_year_check
  check (entry_year is null or entry_year between 2000 and 2100);
alter table public.profiles drop constraint if exists profiles_reviewed_term_check;
alter table public.profiles add constraint profiles_reviewed_term_check
  check (reviewed_term is null or reviewed_term ~ '^[1-3]-[12]$');

alter table public.subjects drop column if exists show_in_school_notes;
alter table public.subjects drop column if exists show_in_mock_notes;
alter table public.subjects drop column if exists mock_max_score;
alter table public.subjects drop column if exists has_percentile;
alter table public.subjects drop column if exists hidden_at;
alter table public.subjects drop constraint if exists subjects_kind_check;
alter table public.subjects add constraint subjects_kind_check check (kind in ('mock', 'school'));
alter table public.subjects drop constraint if exists subjects_term_check;
alter table public.subjects add constraint subjects_term_check check (term is null or term ~ '^[1-3]-[12]$');
-- 같은 종류 안에서, 보관하지 않은 과목끼리만 이름이 겹치면 안 된다
drop index if exists public.subjects_name_key;
create unique index if not exists subjects_active_name_key
  on public.subjects (user_id, kind, name) where deleted_at is null and archived_at is null;

alter table public.ddays drop column if exists review_days;
alter table public.ddays drop column if exists off_weekdays;
alter table public.ddays drop constraint if exists ddays_exam_kind_check;
alter table public.ddays add constraint ddays_exam_kind_check
  check (exam_kind is null or exam_kind in ('school', 'mock', 'other'));

alter table public.tasks drop column if exists range_item_id;
alter table public.tasks drop column if exists range_start_no;
alter table public.tasks drop column if exists range_end_no;
alter table public.tasks drop column if exists goal_id;
alter table public.tasks drop constraint if exists tasks_source_check;
alter table public.tasks add constraint tasks_source_check check (source in ('manual', 'recurrence', 'roadmap'));
alter table public.tasks drop constraint if exists tasks_title_check;
alter table public.tasks add constraint tasks_title_check
  check (title = btrim(title) and char_length(title) between 1 and 80);
-- 로드맵 칸 하나는 할 일 하나로만 넣는다
create unique index if not exists tasks_roadmap_item_key
  on public.tasks (roadmap_item_id) where roadmap_item_id is not null and deleted_at is null;

alter table public.reflections drop column if exists good;
alter table public.reflections drop column if exists bad;
alter table public.reflections drop column if exists tomorrow;
alter table public.reflections drop column if exists condition;
alter table public.reflections drop constraint if exists reflections_comment_check;
alter table public.reflections add constraint reflections_comment_check check (char_length(comment) <= 500);

drop table if exists
  public.review_checks, public.range_items, public.exam_subject_dates, public.goals,
  public.school_grades, public.mock_scores, public.targets, public.records
  cascade;


-- ============================================================================
-- 3. RLS, 권한, updated_at 트리거, 실시간 동기화
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'subjects', 'units', 'timetables', 'timetable_slots', 'holidays', 'date_timetables',
    'recurrences', 'ddays', 'exam_subjects', 'roadmap_items', 'tasks',
    'task_deferrals', 'timer_sessions', 'daily_stats', 'reflections', 'mock_rounds', 'wrong_notes',
    'wrong_note_photos', 'flash_decks', 'flash_cards', 'pending_file_deletions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t
    );
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_id_idx', t);
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
    if t <> 'pending_file_deletions' and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- 자동 작업 기록은 읽기만 (개인 정보 없음)
alter table public.maintenance_runs enable row level security;
drop policy if exists maintenance_runs_read on public.maintenance_runs;
create policy maintenance_runs_read on public.maintenance_runs for select to authenticated using (true);
revoke all on table public.maintenance_runs from anon, authenticated;
grant select on table public.maintenance_runs to authenticated;


-- ============================================================================
-- 4. 트리거: 오답 사진 (최대 5장, 지우면 파일 삭제 대기열에)
-- ============================================================================

create or replace function public.wrong_note_photos_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.wrong_note_photos
    where note_id = new.note_id and deleted_at is null and id <> new.id
  ) >= 5 then
    raise exception '사진은 오답 하나에 5장까지예요' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists wrong_note_photos_limit on public.wrong_note_photos;
create trigger wrong_note_photos_limit
  before insert on public.wrong_note_photos
  for each row execute function public.wrong_note_photos_limit();

-- SQL 로는 Storage 파일을 안전하게 지울 수 없어서, 경로를 쌓아 두면 앱이 지운다 (9.3)
create or replace function public.wrong_note_photos_enqueue_file()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.pending_file_deletions (user_id, storage_path)
  values (old.user_id, old.storage_path);
  return old;
end;
$$;

drop trigger if exists wrong_note_photos_enqueue_file on public.wrong_note_photos;
create trigger wrong_note_photos_enqueue_file
  after delete on public.wrong_note_photos
  for each row execute function public.wrong_note_photos_enqueue_file();


-- ============================================================================
-- 5. 앱에서 부르는 함수 (모두 로그인한 사용자 권한으로 실행, RLS 적용)
-- ============================================================================

-- 5.1 bootstrap_user(): 처음 로그인하면 기본값을 만든다. 몇 번 불러도 결과가 같다 ----
--   모의고사 과목 6개(국어·수학·영어·한국사·통합과학·통합사회)는 고정이라, 빠진 것이 있으면 부를 때마다 채운다.
--   내신 과목은 사용자가 학기마다 정리한다 (새 학기 정리 창).
--   기본 시간표 (5.12), 2026~2028 공휴일 (5.10)
create or replace function public.bootstrap_user()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  h integer;
  weekday_id uuid;
  weekend_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.profiles (user_id) values (uid) on conflict (user_id) do nothing;

  insert into public.subjects (user_id, name, color_key, sort_order, kind)
  select uid, m.name, m.color_key, m.sort_order, 'mock'
  from (values
    ('국어', 'rose', 0), ('수학', 'periwinkle', 1), ('영어', 'mint', 2),
    ('한국사', 'peach', 3), ('통합과학', 'butter', 4), ('통합사회', 'lavender', 5)
  ) as m (name, color_key, sort_order)
  where not exists (
    select 1 from public.subjects s
    where s.user_id = uid and s.kind = 'mock' and s.name = m.name and s.deleted_at is null
  );

  select day_start_hour into h from public.profiles where user_id = uid;

  if not exists (select 1 from public.timetables where user_id = uid) then
    insert into public.timetables (user_id, name, default_for, sort_order)
    values (uid, '평일', 'weekday', 0) returning id into weekday_id;
    insert into public.timetables (user_id, name, default_for, sort_order)
    values (uid, '주말·공휴일', 'weekend', 1) returning id into weekend_id;

    -- 시계 시각(분)을 하루 기준 시각부터 센 분으로 바꿔 넣는다
    insert into public.timetable_slots (user_id, timetable_id, name, category, start_min, end_min)
    select uid, weekday_id, s.name, s.category,
           ((s.start_clock - h * 60) + 1440) % 1440,
           ((s.start_clock - h * 60) + 1440) % 1440 + (s.end_clock - s.start_clock)
    from (values
      ('기상', 'life', 390, 400), ('입실', 'life', 480, 490), ('조례', 'life', 490, 510),
      ('1교시', 'class', 510, 560), ('2교시', 'class', 570, 620), ('3교시', 'class', 630, 680),
      ('4교시', 'class', 690, 740), ('점심 식사', 'meal', 740, 810), ('5교시', 'class', 810, 860),
      ('6교시', 'class', 870, 920), ('7교시', 'class', 930, 980), ('청소', 'life', 980, 1000),
      ('8교시', 'class', 1000, 1050), ('9교시', 'class', 1060, 1110), ('저녁 식사', 'meal', 1110, 1180),
      ('야자 1차시', 'study', 1180, 1260), ('야자 2차시', 'study', 1260, 1340),
      ('야자 3차시', 'study', 1340, 1380), ('귀사', 'life', 1380, 1390), ('점호', 'life', 1410, 1420),
      ('기숙사 1차시', 'study', 0, 60), ('기숙사 2차시', 'study', 60, 120)
    ) as s (name, category, start_clock, end_clock);

    insert into public.timetable_slots (user_id, timetable_id, name, category, start_min, end_min)
    select uid, weekend_id, s.name, s.category,
           ((s.start_clock - h * 60) + 1440) % 1440,
           ((s.start_clock - h * 60) + 1440) % 1440 + (s.end_clock - s.start_clock)
    from (values
      ('기상', 'life', 420, 430), ('아침 식사', 'meal', 450, 520), ('자습 1차시', 'study', 520, 630),
      ('자습 2차시', 'study', 630, 730), ('점심 식사', 'meal', 730, 800), ('자습 3차시', 'study', 800, 900),
      ('자습 4차시', 'study', 900, 1000), ('청소', 'life', 1000, 1020), ('자습 5차시', 'study', 1020, 1080),
      ('저녁 식사', 'meal', 1080, 1140), ('자습 6차시', 'study', 1140, 1200), ('자습 7차시', 'study', 1200, 1260),
      ('자습 8차시', 'study', 1260, 1320), ('자습 9차시', 'study', 1320, 1380), ('점호', 'life', 1350, 1360),
      ('자습 10차시', 'study', 1380, 1440), ('자습 11차시', 'study', 0, 60), ('자습 12차시', 'study', 60, 120)
    ) as s (name, category, start_clock, end_clock);
  end if;

  -- 2026~2028 공휴일 (대체공휴일, 선거일 포함). 첫 실행 뒤 설정 > 공휴일에서 확인하고 고친다
  if not exists (select 1 from public.holidays where user_id = uid) then
    insert into public.holidays (user_id, date, name)
    select uid, d.date::date, d.name
    from (values
      ('2026-01-01', '신정'), ('2026-02-16', '설날 연휴'), ('2026-02-17', '설날'), ('2026-02-18', '설날 연휴'),
      ('2026-03-01', '삼일절'), ('2026-03-02', '대체공휴일'), ('2026-05-01', '노동절'), ('2026-05-05', '어린이날'),
      ('2026-05-24', '부처님오신날'), ('2026-05-25', '대체공휴일'), ('2026-06-03', '전국동시지방선거'),
      ('2026-06-06', '현충일'), ('2026-07-17', '제헌절'), ('2026-08-15', '광복절'), ('2026-08-17', '대체공휴일'),
      ('2026-09-24', '추석 연휴'), ('2026-09-25', '추석'), ('2026-09-26', '추석 연휴'),
      ('2026-10-03', '개천절'), ('2026-10-05', '대체공휴일'), ('2026-10-09', '한글날'), ('2026-12-25', '성탄절'),
      ('2027-01-01', '신정'), ('2027-02-06', '설날 연휴'), ('2027-02-07', '설날'), ('2027-02-08', '설날 연휴'),
      ('2027-02-09', '대체공휴일'), ('2027-03-01', '삼일절'), ('2027-05-01', '노동절'), ('2027-05-03', '대체공휴일'),
      ('2027-05-05', '어린이날'), ('2027-05-13', '부처님오신날'), ('2027-06-06', '현충일'),
      ('2027-07-17', '제헌절'), ('2027-07-19', '대체공휴일'), ('2027-08-15', '광복절'), ('2027-08-16', '대체공휴일'),
      ('2027-09-14', '추석 연휴'), ('2027-09-15', '추석'), ('2027-09-16', '추석 연휴'),
      ('2027-10-03', '개천절'), ('2027-10-04', '대체공휴일'), ('2027-10-09', '한글날'), ('2027-10-11', '대체공휴일'),
      ('2027-12-25', '성탄절'), ('2027-12-27', '대체공휴일'),
      ('2028-01-01', '신정'), ('2028-01-26', '설날 연휴'), ('2028-01-27', '설날'), ('2028-01-28', '설날 연휴'),
      ('2028-03-01', '삼일절'), ('2028-04-12', '국회의원선거'), ('2028-05-01', '노동절'),
      ('2028-05-02', '부처님오신날'), ('2028-05-05', '어린이날'), ('2028-06-06', '현충일'),
      ('2028-07-17', '제헌절'), ('2028-08-15', '광복절'), ('2028-10-02', '추석 연휴'), ('2028-10-03', '추석·개천절'),
      ('2028-10-04', '추석 연휴'), ('2028-10-05', '대체공휴일'), ('2028-10-09', '한글날'), ('2028-12-25', '성탄절')
    ) as d (date, name)
    on conflict do nothing;
  end if;
end;
$$;

-- 5.2 reorder_rows(table, ids): 끌어서 바꾼 순서를 한 번에 저장 -------------------
create or replace function public.reorder_rows(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  col text;
begin
  if p_table not in (
    'subjects', 'units', 'tasks', 'ddays', 'timetables', 'exam_subjects', 'roadmap_items', 'flash_decks',
    'flash_cards', 'wrong_note_photos'
  ) then
    raise exception 'reorder not allowed: %', p_table using errcode = '22023';
  end if;
  col := case when p_table = 'ddays' then 'pin_order' else 'sort_order' end;
  execute format(
    'update public.%I as r set %I = t.ord - 1 '
    'from unnest($1) with ordinality as t (id, ord) '
    'where r.id = t.id and r.user_id = (select auth.uid())',
    p_table, col
  ) using p_ids;
end;
$$;

-- 5.3 휴지통: trash_item / restore_batch / purge_batch (9.4) -------------------
--   함께 지우는 것: 과목 → 오답·단원·시험 과목·로드맵 칸 / 단원 → 오답 / 회차 → 오답
--                   시험 → 시험 과목·로드맵 칸 / 카드 묶음 → 카드 / 시간표 → 항목
create or replace function public.trash_item(p_table text, p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ts timestamptz := now();
begin
  if p_table not in (
    'subjects', 'units', 'timetables', 'timetable_slots', 'holidays', 'date_timetables', 'recurrences',
    'ddays', 'exam_subjects', 'roadmap_items', 'tasks', 'timer_sessions', 'reflections',
    'mock_rounds', 'wrong_notes', 'wrong_note_photos', 'flash_decks', 'flash_cards'
  ) then
    raise exception 'trash not allowed: %', p_table using errcode = '22023';
  end if;

  execute format(
    'update public.%I set deleted_at = $1, delete_batch_id = $2 where id = $2 and user_id = $3 and deleted_at is null',
    p_table
  ) using ts, p_id, uid;

  if p_table = 'subjects' then
    update public.wrong_notes set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
    update public.units set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
    update public.exam_subjects set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
    update public.roadmap_items set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'units' then
    update public.wrong_notes set deleted_at = ts, delete_batch_id = p_id
      where unit_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'mock_rounds' then
    update public.wrong_notes set deleted_at = ts, delete_batch_id = p_id
      where mock_round_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'ddays' then
    update public.exam_subjects set deleted_at = ts, delete_batch_id = p_id
      where dday_id = p_id and user_id = uid and deleted_at is null;
    update public.roadmap_items set deleted_at = ts, delete_batch_id = p_id
      where dday_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'flash_decks' then
    update public.flash_cards set deleted_at = ts, delete_batch_id = p_id
      where deck_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'timetables' then
    update public.timetable_slots set deleted_at = ts, delete_batch_id = p_id
      where timetable_id = p_id and user_id = uid and deleted_at is null;
  end if;

  return p_id;
end;
$$;

create or replace function public.restore_batch(p_batch uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t text;
begin
  foreach t in array array[
    'subjects', 'units', 'timetables', 'timetable_slots', 'holidays', 'date_timetables', 'recurrences',
    'ddays', 'exam_subjects', 'roadmap_items', 'tasks', 'timer_sessions', 'reflections',
    'mock_rounds', 'wrong_notes', 'wrong_note_photos', 'flash_decks', 'flash_cards'
  ] loop
    execute format(
      'update public.%I set deleted_at = null, delete_batch_id = null '
      'where delete_batch_id = $1 and user_id = (select auth.uid())',
      t
    ) using p_batch;
  end loop;
end;
$$;

create or replace function public.purge_batch(p_batch uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t text;
begin
  foreach t in array array[
    'wrong_note_photos', 'wrong_notes', 'flash_cards', 'flash_decks', 'tasks', 'roadmap_items',
    'exam_subjects', 'recurrences', 'ddays', 'timer_sessions', 'reflections', 'units', 'mock_rounds',
    'date_timetables', 'timetable_slots', 'timetables', 'holidays', 'subjects'
  ] loop
    execute format(
      'delete from public.%I where delete_batch_id = $1 and deleted_at is not null and user_id = (select auth.uid())',
      t
    ) using p_batch;
  end loop;
end;
$$;

-- 5.4 미루기: defer_tasks / undefer_tasks (5.6 넘기기·되돌리기·오늘로 가져오기) ---
create or replace function public.defer_tasks(p_ids uuid[], p_to date)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  return query
  with moved as (
    select t.id, t.subject_id, t.title, t.study_date
    from public.tasks t
    where t.id = any (p_ids) and t.user_id = uid and t.deleted_at is null
      and t.done_at is null and t.study_date <> p_to
    for update
  ), logged as (
    insert into public.task_deferrals (user_id, task_id, subject_id, title, from_date, to_date)
    select uid, m.id, m.subject_id, m.title, m.study_date, p_to from moved m
  )
  update public.tasks t
  set study_date = p_to, deferred_count = t.deferred_count + 1, start_min = null, end_min = null, slot_id = null
  from moved m
  where t.id = m.id
  returning t.id;
end;
$$;

create or replace function public.undefer_tasks(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d record;
begin
  for d in
    select distinct on (task_id) id, task_id, from_date
    from public.task_deferrals
    where task_id = any (p_ids) and user_id = uid
    order by task_id, created_at desc
  loop
    update public.tasks
    set study_date = d.from_date, deferred_count = greatest(deferred_count - 1, 0)
    where id = d.task_id and user_id = uid;
    delete from public.task_deferrals where id = d.id;
  end loop;
end;
$$;

-- 5.5 하루 통계: compute_daily_stats / refresh_daily_stats ----------------------
--   하루 = [그날 하루 기준 시각, 다음 날 하루 기준 시각) 한국 시간. 경계를 넘긴 기록은 나눠 센다.
--   실행률 분모 = 그날 할 일 + 그날에서 다른 날로 넘긴 할 일 (8.1)
create or replace function public.compute_daily_stats(p_user uuid, p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h integer;
  win_start timestamptz;
  win_end timestamptz;
begin
  select coalesce(max(day_start_hour), 6) into h from public.profiles where user_id = p_user;
  win_start := (p_date::timestamp + make_interval(hours => h)) at time zone 'Asia/Seoul';
  win_end := win_start + interval '1 day';

  delete from public.daily_stats where user_id = p_user and study_date = p_date;

  insert into public.daily_stats (user_id, study_date, subject_id, study_seconds)
  select p_user, p_date, s.subject_id,
         floor(sum(extract(epoch from (least(coalesce(s.ended_at, now()), win_end) - greatest(s.started_at, win_start)))))::integer
  from public.timer_sessions s
  where s.user_id = p_user and s.kind = 'study' and s.deleted_at is null and s.subject_id is not null
    and s.started_at < win_end and coalesce(s.ended_at, now()) > win_start
  group by s.subject_id;

  insert into public.daily_stats
    (user_id, study_date, subject_id, study_seconds, nap_seconds, nap_count, planned_tasks, done_tasks, deferred_events)
  select p_user, p_date, null,
    coalesce((
      select floor(sum(extract(epoch from (least(coalesce(s.ended_at, now()), win_end) - greatest(s.started_at, win_start)))))
      from public.timer_sessions s
      where s.user_id = p_user and s.kind = 'study' and s.deleted_at is null and s.subject_id is null
        and s.started_at < win_end and coalesce(s.ended_at, now()) > win_start
    ), 0)::integer,
    coalesce((
      select floor(sum(extract(epoch from (least(coalesce(s.ended_at, now()), win_end) - greatest(s.started_at, win_start)))))
      from public.timer_sessions s
      where s.user_id = p_user and s.kind = 'nap' and s.deleted_at is null
        and s.started_at < win_end and coalesce(s.ended_at, now()) > win_start
    ), 0)::integer,
    (
      select count(*) from public.timer_sessions s
      where s.user_id = p_user and s.kind = 'nap' and s.deleted_at is null
        and s.started_at >= win_start and s.started_at < win_end
    )::integer,
    (
      (select count(*) from public.tasks t
        where t.user_id = p_user and t.deleted_at is null and t.study_date = p_date)
      + (select count(distinct coalesce(d.task_id, d.id)) from public.task_deferrals d
        where d.user_id = p_user and d.from_date = p_date
          and not exists (
            select 1 from public.tasks t
            where t.id = d.task_id and t.study_date = p_date and t.deleted_at is null
          ))
    )::integer,
    (
      select count(*) from public.tasks t
      where t.user_id = p_user and t.deleted_at is null and t.study_date = p_date and t.done_at is not null
    )::integer,
    (
      select count(*) from public.task_deferrals d where d.user_id = p_user and d.from_date = p_date
    )::integer;
end;
$$;

-- 앱이 열릴 때 빠진 날짜의 통계를 채운다 (매일 자동 작업이 실패한 날 보충)
create or replace function public.refresh_daily_stats(p_from date, p_to date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_to < p_from or p_to - p_from > 120 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  d := p_from;
  while d <= p_to loop
    perform public.compute_daily_stats(uid, d);
    d := d + 1;
  end loop;
end;
$$;

-- 5.6 restore_backup(json): 백업 파일로 모든 기록을 바꾼다 (한 번에, 실패하면 아무것도 안 바뀜)
--   지금 데이터를 지우고 백업 내용을 넣는다. 사진 파일은 지우지 않는다.
create or replace function public.restore_backup(p_backup jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t text;
  delete_order text[] := array[
    'wrong_note_photos', 'wrong_notes', 'flash_cards', 'flash_decks', 'task_deferrals', 'tasks',
    'roadmap_items', 'exam_subjects', 'recurrences', 'ddays', 'timer_sessions', 'daily_stats', 'reflections',
    'units', 'mock_rounds', 'date_timetables', 'timetable_slots', 'timetables', 'holidays', 'subjects'
  ];
  insert_order text[] := array[
    'subjects', 'holidays', 'timetables', 'timetable_slots', 'date_timetables', 'mock_rounds', 'units',
    'reflections', 'daily_stats', 'timer_sessions', 'ddays', 'exam_subjects', 'roadmap_items', 'recurrences',
    'tasks', 'task_deferrals', 'flash_decks', 'flash_cards', 'wrong_notes', 'wrong_note_photos'
  ];
  p jsonb := p_backup -> 'profile';
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- 이 버전(2)의 백업만 받는다. 앱이 이전 버전(1) 파일을 2로 바꿔서 보낸다.
  if p_backup ->> 'app' is distinct from 'telos' or (p_backup ->> 'version')::integer is distinct from 2 then
    raise exception 'not a Telos backup' using errcode = '22023';
  end if;

  foreach t in array delete_order loop
    execute format('delete from public.%I where user_id = $1', t) using uid;
  end loop;

  foreach t in array insert_order loop
    execute format(
      'insert into public.%1$I '
      'select (jsonb_populate_record(null::public.%1$I, e || jsonb_build_object(''user_id'', $2))).* '
      'from jsonb_array_elements(coalesce($1 -> %2$L, ''[]''::jsonb)) as e',
      t, t
    ) using p_backup -> 'tables', uid;
  end loop;

  -- 이번 복원 중에 사진 행을 지우며 쌓인 파일 삭제 대기열은 취소한다 (파일은 남겨 둔다)
  delete from public.pending_file_deletions where user_id = uid and created_at = now();

  if p is not null then
    update public.profiles set
      theme = coalesce(p ->> 'theme', theme),
      day_start_hour = coalesce((p ->> 'day_start_hour')::smallint, day_start_hour),
      sem1_start = coalesce(p ->> 'sem1_start', sem1_start),
      sem1_end = coalesce(p ->> 'sem1_end', sem1_end),
      sem2_start = coalesce(p ->> 'sem2_start', sem2_start),
      sem2_end = coalesce(p ->> 'sem2_end', sem2_end),
      entry_year = coalesce((p ->> 'entry_year')::smallint, entry_year),
      reviewed_term = coalesce(p ->> 'reviewed_term', reviewed_term),
      sidebar_collapsed = coalesce((p ->> 'sidebar_collapsed')::boolean, sidebar_collapsed)
    where user_id = uid;
  end if;
end;
$$;

-- 권한: 로그인한 사용자만
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.bootstrap_user()',
    'public.reorder_rows(text, uuid[])',
    'public.trash_item(text, uuid)',
    'public.restore_batch(uuid)',
    'public.purge_batch(uuid)',
    'public.defer_tasks(uuid[], date)',
    'public.undefer_tasks(uuid[])',
    'public.compute_daily_stats(uuid, date)',
    'public.refresh_daily_stats(date, date)',
    'public.restore_backup(jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;


-- ============================================================================
-- 6. 매일 자동 작업 (9.3): run_daily_maintenance()
--    pg_cron 이 매일 21:10 UTC(한국 06:10)에 실행한다. 몇 번 실행해도 결과가 같다.
--    순서: daily_stats 확정 → 3개월 지난 timer_sessions → 30일 지난 할 일·D-day → 휴지통 7일
-- ============================================================================

create or replace function public.run_daily_maintenance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  t text;
  today date;
  d date;
  problems text := '';
begin
  for r in select user_id, day_start_hour from public.profiles loop
    begin
      today := ((now() at time zone 'Asia/Seoul') - make_interval(hours => r.day_start_hour))::date;

      -- 1) 어제까지 최근 7일 통계를 다시 계산 (실패한 날도 함께 채운다)
      d := today - 7;
      while d < today loop
        perform public.compute_daily_stats(r.user_id, d);
        d := d + 1;
      end loop;

      -- 2) 3개월 지난 원본 기록: 그날 daily_stats 가 없으면 먼저 만들고, 있을 때만 지운다
      for d in
        select distinct ((s.started_at at time zone 'Asia/Seoul') - make_interval(hours => r.day_start_hour))::date
        from public.timer_sessions s
        where s.user_id = r.user_id and s.ended_at is not null and s.ended_at < now() - interval '3 months'
          and not exists (
            select 1 from public.daily_stats ds
            where ds.user_id = s.user_id
              and ds.study_date = ((s.started_at at time zone 'Asia/Seoul') - make_interval(hours => r.day_start_hour))::date
          )
      loop
        perform public.compute_daily_stats(r.user_id, d);
      end loop;

      delete from public.timer_sessions s
      where s.user_id = r.user_id
        and s.ended_at is not null
        and s.ended_at < now() - interval '3 months'
        and exists (
          select 1 from public.daily_stats ds
          where ds.user_id = s.user_id
            and ds.study_date = ((s.started_at at time zone 'Asia/Seoul') - make_interval(hours => r.day_start_hour))::date
        );

      -- 3) 30일 지난 할 일(완료·미완료 모두), 끝난 일정, 완료한 수행평가.
      --    시험(시험 대비 로드맵)은 기록 화면에 남기려고 지우지 않는다.
      delete from public.tasks where user_id = r.user_id and study_date < today - 30;
      delete from public.task_deferrals where user_id = r.user_id and from_date < today - 90;
      delete from public.ddays dd
      where dd.user_id = r.user_id and dd.type <> 'exam'
        and (
          dd.date < today - 30
          or (dd.type = 'performance' and dd.status = 'done' and dd.updated_at < now() - interval '30 days')
        );

      -- 4) 휴지통에서 7일 지난 행 완전 삭제 (오답 사진은 트리거가 파일 삭제 대기열에 넣는다)
      foreach t in array array[
        'wrong_note_photos', 'wrong_notes', 'flash_cards', 'flash_decks', 'tasks', 'roadmap_items',
        'exam_subjects', 'recurrences', 'ddays', 'timer_sessions', 'reflections', 'units', 'mock_rounds',
        'date_timetables', 'timetable_slots', 'timetables', 'holidays', 'subjects'
      ] loop
        execute format(
          'delete from public.%I where user_id = $1 and deleted_at < now() - interval ''7 days''', t
        ) using r.user_id;
      end loop;
    exception when others then
      problems := problems || r.user_id::text || ': ' || sqlerrm || '; ';
    end;
  end loop;

  insert into public.maintenance_runs (ok, detail) values (problems = '', nullif(problems, ''));
end;
$$;

revoke all on function public.run_daily_maintenance() from public, anon, authenticated;


-- ============================================================================
-- 7. Storage: 오답 사진 비공개 버킷 wrong-notes (서명된 URL 로만 표시)
--    경로 규칙: <user_id>/<note_id>/<파일이름>
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wrong-notes', 'wrong-notes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "wrong-notes read own" on storage.objects;
create policy "wrong-notes read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'wrong-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "wrong-notes insert own" on storage.objects;
create policy "wrong-notes insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wrong-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "wrong-notes update own" on storage.objects;
create policy "wrong-notes update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'wrong-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "wrong-notes delete own" on storage.objects;
create policy "wrong-notes delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wrong-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ============================================================================
-- 8. pg_cron 등록: 매일 21:10 UTC = 한국 시간 06:10
--    pg_cron 확장이 켜져 있어야 한다 (안내 문서 참고). 꺼져 있으면 알림만 남긴다.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('telos-daily-maintenance', '10 21 * * *', 'select public.run_daily_maintenance()');
    raise notice 'pg_cron 작업 telos-daily-maintenance 를 등록했어요 (매일 한국 시간 06:10).';
  else
    raise notice 'pg_cron 확장이 꺼져 있어서 매일 자동 작업을 등록하지 않았어요. 확장을 켠 뒤 이 파일을 다시 실행하세요.';
  end if;
end;
$$;


-- 확인: 오류 없이 여기까지 오면 준비 완료
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in (
    'profiles', 'subjects', 'units', 'timetables', 'timetable_slots', 'holidays', 'date_timetables',
    'recurrences', 'ddays', 'exam_subjects', 'roadmap_items', 'tasks',
    'task_deferrals', 'timer_sessions', 'daily_stats', 'reflections', 'mock_rounds', 'wrong_notes',
    'wrong_note_photos', 'flash_decks', 'flash_cards', 'pending_file_deletions', 'maintenance_runs'
  )) as "테이블 수 (23 이면 정상)",
  (select count(*) from storage.buckets where id = 'wrong-notes') as "사진 버킷 (1 이면 정상)",
  (select count(*) from pg_extension where extname = 'pg_cron') as "pg_cron 확장 (1 이면 켜짐)";
