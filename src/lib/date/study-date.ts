import { formatInTimeZone } from "date-fns-tz";
import { ko } from "date-fns/locale";

/** 모든 날짜 계산은 한국 시간 기준 (2장) */
export const TIME_ZONE = "Asia/Seoul";

/** 하루가 바뀌는 기본 시각: 오전 6시 (5.1) */
export const DEFAULT_DAY_START_HOUR = 6;

const HOUR_MS = 60 * 60 * 1000;

/**
 * 공부 날짜(study_date) 계산 (5.1).
 * 하루 기준 시각 전에 한 일은 전날로 센다. 예) 기준 6시면 11월 2일 05:59 → "2026-11-01".
 * 한국은 서머타임이 없으므로 기준 시각만큼 시간을 빼고 한국 날짜를 읽으면 된다.
 */
export function getStudyDate(instant: Date, dayStartHour: number = DEFAULT_DAY_START_HOUR): string {
  if (!Number.isInteger(dayStartHour) || dayStartHour < 0 || dayStartHour > 23) {
    throw new RangeError(`dayStartHour must be an integer 0-23: ${dayStartHour}`);
  }
  const shifted = new Date(instant.getTime() - dayStartHour * HOUR_MS);
  return formatInTimeZone(shifted, TIME_ZONE, "yyyy-MM-dd");
}

/** "2026-11-02" → "11월 2일 월요일" (5.2 머리말) */
export function formatStudyDateLong(studyDate: string): string {
  // 정오로 잡으면 어느 시간대에서 읽어도 같은 날짜가 된다
  const noon = new Date(`${studyDate}T12:00:00+09:00`);
  return formatInTimeZone(noon, TIME_ZONE, "M월 d일 EEEE", { locale: ko });
}
