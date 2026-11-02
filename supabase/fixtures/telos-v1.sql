-- 테스트 전용: 1차 수정 이전(Phase 1~6) 버전의 telos.sql 그대로.
-- supabase/telos.test.ts 가 이 파일로 옛 DB 를 만든 뒤 새 telos.sql 로 올리는 과정을 확인한다. 실행하지 마세요.

-- ============================================================================
-- Telos 데이터베이스 전체 설정 (Phase 1~6)
--
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여 넣고 Run.
--   - 여러 번 실행해도 안전하다. 이미 있는 테이블·데이터는 그대로 두고, 함수·정책은 새로 만든다.
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
  auto_range_tasks boolean not null default true,
  sidebar_collapsed boolean not null default false,
  last_backup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id),
  constraint profiles_theme_check check (theme in ('light', 'dark', 'system')),
  constraint profiles_day_start_hour_check check (day_start_hour between 0 and 12),
  constraint profiles_semester_check check (
    sem1_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and sem1_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and sem2_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and sem2_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  )
);

-- 2.2 subjects: 과목 ----------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color_key text not null,
  sort_order integer not null default 0,
  show_in_school_notes boolean not null default true,
  show_in_mock_notes boolean not null default false,
  mock_max_score smallint,
  has_percentile boolean not null default false,
  hidden_at timestamptz,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_name_check check (name = btrim(name) and char_length(name) between 1 and 20),
  constraint subjects_color_key_check check (
    color_key in ('rose', 'periwinkle', 'mint', 'butter', 'lavender', 'peach', 'sky', 'sage')
  ),
  constraint subjects_mock_max_score_check check (mock_max_score is null or mock_max_score between 1 and 100)
);
create unique index if not exists subjects_name_key on public.subjects (user_id, name) where deleted_at is null;

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

-- 2.7 goals: 로드맵 (6.2) ------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  subject_id uuid references public.subjects (id) on delete set null,
  level text not null,
  start_date date not null,
  end_date date not null,
  parent_id uuid references public.goals (id) on delete cascade,
  sort_order integer not null default 0,
  done_at timestamptz,
  memo text,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_title_check check (title = btrim(title) and char_length(title) between 1 and 60),
  constraint goals_level_check check (level in ('long', 'month', 'week')),
  constraint goals_dates_check check (start_date <= end_date),
  constraint goals_memo_check check (memo is null or char_length(memo) <= 500),
  constraint goals_parent_check check (parent_id is null or parent_id <> id)
);
create index if not exists goals_parent_idx on public.goals (parent_id);

-- 2.8 ddays / exam_subject_dates (5.3, 6.5) ------------------------------------
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
  review_days smallint not null default 3,
  off_weekdays smallint[] not null default '{}',
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
  constraint ddays_review_days_check check (review_days between 0 and 30),
  constraint ddays_off_weekdays_check check (off_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
);

create table if not exists public.exam_subject_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dday_id uuid not null references public.ddays (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  date date not null,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists exam_subject_dates_key
  on public.exam_subject_dates (dday_id, subject_id) where deleted_at is null;

-- 2.9 range_items / review_checks: 범위 분배, 회독 (6.5) -----------------------
create table if not exists public.range_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dday_id uuid not null references public.ddays (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  unit_label text not null default 'page',
  start_no integer not null,
  end_no integer not null,
  done_amount integer not null default 0,
  sort_order integer not null default 0,
  default_slot_name text,
  default_start_min smallint,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint range_items_name_check check (name = btrim(name) and char_length(name) between 1 and 40),
  constraint range_items_unit_check check (unit_label in ('page', 'unit', 'chapter', 'problem')),
  constraint range_items_no_check check (start_no >= 0 and start_no <= end_no and end_no <= 100000),
  constraint range_items_done_check check (done_amount >= 0),
  constraint range_items_start_min_check check (
    default_start_min is null or (default_start_min between 0 and 1430 and default_start_min % 10 = 0)
  )
);
create index if not exists range_items_dday_idx on public.range_items (dday_id);

create table if not exists public.review_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dday_id uuid not null references public.ddays (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  round1 boolean not null default false,
  round2 boolean not null default false,
  round3 boolean not null default false,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists review_checks_key on public.review_checks (dday_id, unit_id) where deleted_at is null;

-- 2.10 tasks: 할 일 (5.6) ------------------------------------------------------
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
  range_item_id uuid references public.range_items (id) on delete set null,
  range_start_no integer,
  range_end_no integer,
  goal_id uuid references public.goals (id) on delete set null,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_check check (title = btrim(title) and char_length(title) between 1 and 60),
  constraint tasks_est_check check (est_minutes is null or est_minutes between 5 and 600),
  constraint tasks_counts_check check (deferred_count >= 0 and missed_streak >= 0),
  constraint tasks_source_check check (source in ('manual', 'recurrence', 'range', 'goal')),
  constraint tasks_block_check check (
    (start_min is null and end_min is null)
    or (start_min >= 0 and end_min <= 1440 and start_min < end_min and start_min % 10 = 0 and end_min % 10 = 0)
  ),
  constraint tasks_range_check check (
    (range_start_no is null and range_end_no is null) or (range_start_no <= range_end_no)
  ),
  -- 같은 반복·같은 날짜, 같은 범위·같은 날짜는 하나만 (지운 것 포함: "이번만 삭제"한 날은 다시 만들지 않는다)
  constraint tasks_recurrence_date_key unique (recurrence_id, study_date),
  constraint tasks_range_date_key unique (range_item_id, study_date)
);
create index if not exists tasks_user_date_idx on public.tasks (user_id, study_date);

-- 2.11 task_deferrals: 미룬 기록 (5.7, 8.1 실행률·미루기 분석) ----------------
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

-- 2.12 timer_sessions: 공부·쪽잠 기록 (5.4, 5.5) -------------------------------
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

-- 2.13 daily_stats: 하루 합계 (계속 보관) --------------------------------------
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

-- 2.14 reflections: 하루 회고 (5.8) --------------------------------------------
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  study_date date not null,
  good text not null default '',
  bad text not null default '',
  tomorrow text not null default '',
  condition smallint,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reflections_text_check check (
    char_length(good) <= 200 and char_length(bad) <= 200 and char_length(tomorrow) <= 200
  ),
  constraint reflections_condition_check check (condition is null or condition between 1 and 5)
);
create unique index if not exists reflections_date_key on public.reflections (user_id, study_date) where deleted_at is null;

-- 2.15 mock_rounds: 모의고사 회차 (8.3) ----------------------------------------
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

-- 2.16 wrong_notes / wrong_note_photos: 오답노트 (7장) -------------------------
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

-- 2.17 flash_decks / flash_cards: 암기 카드 (7.4) ------------------------------
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

-- 2.18 school_grades: 내신 (8.2) -----------------------------------------------
create table if not exists public.school_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year smallint not null,
  semester smallint not null,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  credits smallint not null,
  raw_score numeric(4, 1) not null,
  subject_avg numeric(4, 1),
  achievement text,
  rank integer,
  tie_count integer not null default 1,
  total_students integer,
  grade smallint,
  grade_manual boolean not null default false,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_grades_year_check check (year between 1 and 3),
  constraint school_grades_semester_check check (semester between 1 and 2),
  constraint school_grades_credits_check check (credits between 1 and 8),
  constraint school_grades_raw_check check (raw_score between 0 and 100),
  constraint school_grades_avg_check check (subject_avg is null or subject_avg between 0 and 100),
  constraint school_grades_achievement_check check (achievement is null or achievement in ('A', 'B', 'C', 'D', 'E')),
  constraint school_grades_rank_check check (
    (rank is null and total_students is null)
    or (rank >= 1 and total_students >= 1 and rank <= total_students)
  ),
  constraint school_grades_tie_check check (tie_count >= 1),
  constraint school_grades_grade_check check (grade is null or grade between 1 and 5)
);
create unique index if not exists school_grades_key
  on public.school_grades (user_id, year, semester, subject_id) where deleted_at is null;

-- 2.19 mock_scores: 모의고사 점수 (8.3) ----------------------------------------
create table if not exists public.mock_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mock_round_id uuid not null references public.mock_rounds (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  raw_score numeric(4, 1),
  percentile numeric(4, 1),
  grade smallint,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_scores_raw_check check (raw_score is null or raw_score between 0 and 100),
  constraint mock_scores_percentile_check check (percentile is null or percentile between 0 and 100),
  constraint mock_scores_grade_check check (grade is null or grade between 1 and 9),
  constraint mock_scores_any_check check (raw_score is not null or percentile is not null or grade is not null)
);
create unique index if not exists mock_scores_key
  on public.mock_scores (mock_round_id, subject_id) where deleted_at is null;

-- 2.20 targets: 목표 등급 (8.4) ------------------------------------------------
create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  school_target smallint,
  mock_target smallint,
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint targets_school_check check (school_target is null or school_target between 1 and 5),
  constraint targets_mock_check check (mock_target is null or mock_target between 1 and 9)
);
create unique index if not exists targets_subject_key on public.targets (subject_id) where deleted_at is null;

-- 2.21 records: 생기부 기록 (8.5) ----------------------------------------------
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  date date not null,
  content text not null default '',
  deleted_at timestamptz,
  delete_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint records_kind_check check (kind in ('seteuk', 'reading', 'club', 'etc')),
  constraint records_title_check check (title = btrim(title) and char_length(title) between 1 and 60),
  constraint records_content_check check (char_length(content) <= 2000)
);

-- 2.22 pending_file_deletions: 지울 사진 파일 (9.3) ----------------------------
create table if not exists public.pending_file_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.23 maintenance_runs: 매일 자동 작업 기록 (9.3) -----------------------------
create table if not exists public.maintenance_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  detail text
);


-- ============================================================================
-- 3. RLS, 권한, updated_at 트리거, 실시간 동기화
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'subjects', 'units', 'timetables', 'timetable_slots', 'holidays', 'date_timetables',
    'recurrences', 'goals', 'ddays', 'exam_subject_dates', 'range_items', 'review_checks', 'tasks',
    'task_deferrals', 'timer_sessions', 'daily_stats', 'reflections', 'mock_rounds', 'wrong_notes',
    'wrong_note_photos', 'flash_decks', 'flash_cards', 'school_grades', 'mock_scores', 'targets',
    'records', 'pending_file_deletions'
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
--   기본 과목 (3.3, 8.3):
--     국어·수학: 내신·모의 오답, 모의 만점 100, 백분위 있음 / 영어: 만점 100, 백분위 없음
--     과학·사회: 내신만 / 한국사: 만점 50, 백분위 없음 / 탐구1·탐구2: 모의만, 만점 50, 백분위 있음
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

  if found then
    insert into public.subjects
      (user_id, name, color_key, sort_order, show_in_school_notes, show_in_mock_notes, mock_max_score, has_percentile)
    values
      (uid, '국어',   'rose',       0, true,  true,  100,  true),
      (uid, '수학',   'periwinkle', 1, true,  true,  100,  true),
      (uid, '영어',   'mint',       2, true,  true,  100,  false),
      (uid, '과학',   'butter',     3, true,  false, null, false),
      (uid, '사회',   'lavender',   4, true,  false, null, false),
      (uid, '한국사', 'peach',      5, true,  true,  50,   false),
      (uid, '탐구1',  'sky',        6, false, true,  50,   true),
      (uid, '탐구2',  'sage',       7, false, true,  50,   true)
    on conflict do nothing;
  end if;

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
      ('야자 3차시', 'study', 1340, 1380), ('귀사', 'life', 1380, 1390), ('점호', 'life', 1410, 1420)
    ) as s (name, category, start_clock, end_clock);

    insert into public.timetable_slots (user_id, timetable_id, name, category, start_min, end_min)
    select uid, weekend_id, s.name, s.category,
           ((s.start_clock - h * 60) + 1440) % 1440,
           ((s.start_clock - h * 60) + 1440) % 1440 + (s.end_clock - s.start_clock)
    from (values
      ('기상', 'life', 420, 430), ('아침 식사', 'meal', 450, 520), ('자습 1차시', 'study', 520, 630),
      ('자습 2차시', 'study', 630, 730), ('점심 식사', 'meal', 730, 800), ('자습 3차시', 'study', 800, 900),
      ('자습 4차시', 'study', 900, 1000), ('청소', 'life', 1000, 1020), ('자습 5차시', 'study', 1020, 1080),
      ('저녁 식사', 'meal', 1080, 1140), ('점호', 'life', 1350, 1360)
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
    'subjects', 'units', 'tasks', 'goals', 'ddays', 'timetables', 'range_items', 'flash_decks', 'flash_cards',
    'wrong_note_photos'
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
--   함께 지우는 것: 과목 → 오답·단원·성적·목표 등급·범위 / 단원 → 오답 / 회차 → 오답·점수
--                   시험 → 범위 / 목표 → 하위 목표 / 카드 묶음 → 카드 / 시간표 → 항목
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
    'subjects', 'units', 'timetables', 'timetable_slots', 'holidays', 'date_timetables', 'recurrences', 'goals',
    'ddays', 'exam_subject_dates', 'range_items', 'review_checks', 'tasks', 'timer_sessions', 'reflections',
    'mock_rounds', 'wrong_notes', 'wrong_note_photos', 'flash_decks', 'flash_cards', 'school_grades',
    'mock_scores', 'targets', 'records'
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
    update public.school_grades set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
    update public.mock_scores set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
    update public.targets set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
    update public.range_items set deleted_at = ts, delete_batch_id = p_id
      where subject_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'units' then
    update public.wrong_notes set deleted_at = ts, delete_batch_id = p_id
      where unit_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'mock_rounds' then
    update public.wrong_notes set deleted_at = ts, delete_batch_id = p_id
      where mock_round_id = p_id and user_id = uid and deleted_at is null;
    update public.mock_scores set deleted_at = ts, delete_batch_id = p_id
      where mock_round_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'ddays' then
    update public.range_items set deleted_at = ts, delete_batch_id = p_id
      where dday_id = p_id and user_id = uid and deleted_at is null;
  elsif p_table = 'goals' then
    with recursive tree as (
      select g.id from public.goals g where g.parent_id = p_id and g.user_id = uid
      union all
      select g.id from public.goals g join tree on g.parent_id = tree.id
    )
    update public.goals set deleted_at = ts, delete_batch_id = p_id
      where id in (select id from tree) and deleted_at is null;
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
    'subjects', 'units', 'timetables', 'timetable_slots', 'holidays', 'date_timetables', 'recurrences', 'goals',
    'ddays', 'exam_subject_dates', 'range_items', 'review_checks', 'tasks', 'timer_sessions', 'reflections',
    'mock_rounds', 'wrong_notes', 'wrong_note_photos', 'flash_decks', 'flash_cards', 'school_grades',
    'mock_scores', 'targets', 'records'
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
    'wrong_note_photos', 'wrong_notes', 'flash_cards', 'flash_decks', 'review_checks', 'tasks', 'range_items',
    'exam_subject_dates', 'recurrences', 'goals', 'ddays', 'mock_scores', 'school_grades', 'targets', 'records',
    'timer_sessions', 'reflections', 'units', 'mock_rounds', 'date_timetables', 'timetable_slots', 'timetables',
    'holidays', 'subjects'
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
    'wrong_note_photos', 'wrong_notes', 'flash_cards', 'flash_decks', 'review_checks', 'task_deferrals', 'tasks',
    'range_items', 'exam_subject_dates', 'recurrences', 'goals', 'ddays', 'mock_scores', 'school_grades', 'targets',
    'records', 'timer_sessions', 'daily_stats', 'reflections', 'units', 'mock_rounds', 'date_timetables',
    'timetable_slots', 'timetables', 'holidays', 'subjects'
  ];
  insert_order text[] := array[
    'subjects', 'holidays', 'timetables', 'timetable_slots', 'date_timetables', 'mock_rounds', 'units',
    'reflections', 'daily_stats', 'timer_sessions', 'records', 'targets', 'school_grades', 'mock_scores', 'ddays',
    'goals', 'recurrences', 'exam_subject_dates', 'range_items', 'tasks', 'task_deferrals', 'review_checks',
    'flash_decks', 'flash_cards', 'wrong_notes', 'wrong_note_photos'
  ];
  p jsonb := p_backup -> 'profile';
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_backup ->> 'app' is distinct from 'telos' or (p_backup ->> 'version')::integer is distinct from 1 then
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
      auto_range_tasks = coalesce((p ->> 'auto_range_tasks')::boolean, auto_range_tasks),
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

      -- 3) 30일 지난 할 일(완료·미완료 모두), 끝난 D-day, 완료한 수행평가
      delete from public.tasks where user_id = r.user_id and study_date < today - 30;
      delete from public.task_deferrals where user_id = r.user_id and from_date < today - 90;
      delete from public.ddays dd
      where dd.user_id = r.user_id
        and (
          (dd.date < today - 30 and not exists (
            select 1 from public.exam_subject_dates e where e.dday_id = dd.id and e.date >= today - 30
          ))
          or (dd.type = 'performance' and dd.status = 'done' and dd.updated_at < now() - interval '30 days')
        );

      -- 4) 휴지통에서 7일 지난 행 완전 삭제 (오답 사진은 트리거가 파일 삭제 대기열에 넣는다)
      foreach t in array array[
        'wrong_note_photos', 'wrong_notes', 'flash_cards', 'flash_decks', 'review_checks', 'tasks', 'range_items',
        'exam_subject_dates', 'recurrences', 'goals', 'ddays', 'mock_scores', 'school_grades', 'targets', 'records',
        'timer_sessions', 'reflections', 'units', 'mock_rounds', 'date_timetables', 'timetable_slots', 'timetables',
        'holidays', 'subjects'
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
    'recurrences', 'goals', 'ddays', 'exam_subject_dates', 'range_items', 'review_checks', 'tasks',
    'task_deferrals', 'timer_sessions', 'daily_stats', 'reflections', 'mock_rounds', 'wrong_notes',
    'wrong_note_photos', 'flash_decks', 'flash_cards', 'school_grades', 'mock_scores', 'targets', 'records',
    'pending_file_deletions', 'maintenance_runs'
  )) as "테이블 수 (29 이면 정상)",
  (select count(*) from storage.buckets where id = 'wrong-notes') as "사진 버킷 (1 이면 정상)",
  (select count(*) from pg_extension where extname = 'pg_cron') as "pg_cron 확장 (1 이면 켜짐)";
