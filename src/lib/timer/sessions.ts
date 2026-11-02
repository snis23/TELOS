import { getStudyDate } from "@/lib/date/study-date";
import { overlapSeconds, studyDayWindow } from "@/lib/stats/daily";
import type { TimerSessionRow } from "@/lib/supabase/database.types";

/** 한 기록이 이 시간을 넘으면 다음에 화면을 열 때 묻는다 (5.4) */
export const LONG_SESSION_MS = 3 * 60 * 60 * 1000;

export function sessionSeconds(session: Pick<TimerSessionRow, "started_at" | "ended_at">, now: Date): number {
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.floor((end - new Date(session.started_at).getTime()) / 1000));
}

export function isLongRunning(session: Pick<TimerSessionRow, "started_at" | "ended_at">, now: Date): boolean {
  return !session.ended_at && now.getTime() - new Date(session.started_at).getTime() > LONG_SESSION_MS;
}

type S = Pick<TimerSessionRow, "kind" | "subject_id" | "started_at" | "ended_at" | "deleted_at">;

/** 그날(하루 기준 시각 적용) 과목별 순공 초. 쪽잠은 빼고, 경계를 넘긴 기록은 그날 몫만 */
export function studySecondsBySubject(sessions: readonly S[], studyDate: string, dayStartHour: number, now: Date) {
  const window = studyDayWindow(studyDate, dayStartHour);
  const map = new Map<string, number>();
  let total = 0;
  for (const s of sessions) {
    if (s.deleted_at || s.kind !== "study") continue;
    const sec = overlapSeconds(s.started_at, s.ended_at, window, now);
    if (!sec) continue;
    total += sec;
    if (s.subject_id) map.set(s.subject_id, (map.get(s.subject_id) ?? 0) + sec);
  }
  return { total, bySubject: map };
}

/** 그날 쪽잠 합계와 횟수 */
export function napSummary(sessions: readonly S[], studyDate: string, dayStartHour: number, now: Date) {
  const window = studyDayWindow(studyDate, dayStartHour);
  let seconds = 0;
  let count = 0;
  for (const s of sessions) {
    if (s.deleted_at || s.kind !== "nap") continue;
    seconds += overlapSeconds(s.started_at, s.ended_at, window, now);
    if (getStudyDate(new Date(s.started_at), dayStartHour) === studyDate) count += 1;
  }
  return { seconds, count };
}

/**
 * 공부 날짜와 "HH:MM" 으로 시각 만들기 (기록 수정·직접 추가).
 * 하루 기준 시각보다 이른 시각은 다음 날 새벽으로 본다. 예) 기준 6시, 01:30 → 다음 날 01:30
 */
export function clockToInstant(studyDate: string, clock: string, dayStartHour: number): Date {
  const [h, m] = clock.split(":").map(Number);
  const base = new Date(`${studyDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`);
  if (h < dayStartHour) base.setUTCDate(base.getUTCDate() + 1);
  return base;
}

/** 기기 이름 (다른 기기에서 측정 중일 때 알려 주는 용도) */
export function guessDeviceLabel(): string {
  if (typeof navigator === "undefined") return "기기";
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints > 1;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return "패드";
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "패드";
  if (/iPhone|Android.*Mobile/.test(ua)) return "폰";
  return "PC";
}
