import { fromZonedTime } from "date-fns-tz";
import { TIME_ZONE } from "@/lib/date/study-date";

/**
 * 하루 통계 계산 (supabase/telos.sql 의 compute_daily_stats 와 같은 규칙).
 * 하루 = [그날 하루 기준 시각, 다음 날 하루 기준 시각) 한국 시간. 경계를 넘긴 기록은 나눠 센다.
 */

export type Interval = { start: Date; end: Date };

export function studyDayWindow(studyDate: string, dayStartHour: number): Interval {
  const hh = String(dayStartHour).padStart(2, "0");
  const start = fromZonedTime(`${studyDate}T${hh}:00:00`, TIME_ZONE);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** 기록 하나가 구간과 겹치는 초 (켜진 기록은 now 까지) */
export function overlapSeconds(startedAt: string, endedAt: string | null, window: Interval, now: Date): number {
  const s = Math.max(new Date(startedAt).getTime(), window.start.getTime());
  const e = Math.min(endedAt ? new Date(endedAt).getTime() : now.getTime(), window.end.getTime());
  return e > s ? Math.floor((e - s) / 1000) : 0;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 기록 하나를 공부 날짜별 초로 나눈다 (5.4 하루 경계) */
export function splitByStudyDate(
  startedAt: string,
  endedAt: string | null,
  dayStartHour: number,
  now: Date,
  getStudyDateFn: (instant: Date, h: number) => string,
): { date: string; seconds: number }[] {
  const end = endedAt ? new Date(endedAt) : now;
  const result: { date: string; seconds: number }[] = [];
  let date = getStudyDateFn(new Date(startedAt), dayStartHour);
  const last = getStudyDateFn(new Date(Math.max(end.getTime() - 1, new Date(startedAt).getTime())), dayStartHour);
  for (let guard = 0; guard < 400; guard += 1) {
    const seconds = overlapSeconds(startedAt, endedAt, studyDayWindow(date, dayStartHour), now);
    if (seconds > 0) result.push({ date, seconds });
    if (date >= last) break;
    date = addDays(date, 1);
  }
  return result;
}

export type StatSession = {
  kind: "study" | "nap";
  subject_id: string | null;
  started_at: string;
  ended_at: string | null;
  deleted_at?: string | null;
};
export type StatTask = { id: string; study_date: string; done_at: string | null; deleted_at?: string | null };
export type StatDeferral = { id: string; task_id: string | null; from_date: string };

export type DailyStatValues = {
  subject_id: string | null;
  study_seconds: number;
  nap_seconds: number;
  nap_count: number;
  planned_tasks: number;
  done_tasks: number;
  deferred_events: number;
};

export function computeDailyStats(input: {
  studyDate: string;
  dayStartHour: number;
  sessions: readonly StatSession[];
  tasks: readonly StatTask[];
  deferrals: readonly StatDeferral[];
  now: Date;
}): DailyStatValues[] {
  const { studyDate, dayStartHour, now } = input;
  const window = studyDayWindow(studyDate, dayStartHour);
  const sessions = input.sessions.filter((s) => !s.deleted_at);
  const bySubject = new Map<string, number>();
  let studyNoSubject = 0;
  let napSeconds = 0;
  let napCount = 0;

  for (const s of sessions) {
    const sec = overlapSeconds(s.started_at, s.ended_at, window, now);
    if (s.kind === "nap") {
      napSeconds += sec;
      const started = new Date(s.started_at).getTime();
      if (started >= window.start.getTime() && started < window.end.getTime()) napCount += 1;
    } else if (sec > 0) {
      if (s.subject_id) bySubject.set(s.subject_id, (bySubject.get(s.subject_id) ?? 0) + sec);
      else studyNoSubject += sec;
    }
  }

  const tasks = input.tasks.filter((t) => !t.deleted_at);
  const onDate = tasks.filter((t) => t.study_date === studyDate);
  const onDateIds = new Set(onDate.map((t) => t.id));
  const deferredFrom = input.deferrals.filter((d) => d.from_date === studyDate);
  const movedAway = new Set(
    deferredFrom.filter((d) => !(d.task_id && onDateIds.has(d.task_id))).map((d) => d.task_id ?? d.id),
  );

  const rows: DailyStatValues[] = [...bySubject.entries()].map(([subject_id, study_seconds]) => ({
    subject_id,
    study_seconds,
    nap_seconds: 0,
    nap_count: 0,
    planned_tasks: 0,
    done_tasks: 0,
    deferred_events: 0,
  }));
  rows.push({
    subject_id: null,
    study_seconds: studyNoSubject,
    nap_seconds: napSeconds,
    nap_count: napCount,
    planned_tasks: onDate.length + movedAway.size,
    done_tasks: onDate.filter((t) => t.done_at).length,
    deferred_events: deferredFrom.length,
  });
  return rows;
}
