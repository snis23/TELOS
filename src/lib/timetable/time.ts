/** 하루 기준 시각부터 센 분(0~1440) ↔ 시계 시각 (9.1) */

export const DAY_MIN = 1440;
export const SNAP = 10;

const pad = (n: number) => String(n).padStart(2, "0");

/** 하루 분 → 시계 분 (0~1439) */
export function dayMinToClock(dayMin: number, dayStartHour: number): number {
  return (dayMin + dayStartHour * 60) % DAY_MIN;
}

/** 하루 분 → "HH:MM" */
export function formatDayMin(dayMin: number, dayStartHour: number): string {
  const c = dayMinToClock(dayMin, dayStartHour);
  return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`;
}

/** 시계 분 → 하루 분 */
export function clockToDayMin(clockMin: number, dayStartHour: number): number {
  return (((clockMin - dayStartHour * 60) % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

/** 10분 칸에 맞추기 */
export function snap(min: number, mode: "floor" | "round" | "ceil" = "round"): number {
  const fn = mode === "floor" ? Math.floor : mode === "ceil" ? Math.ceil : Math.round;
  return fn(min / SNAP) * SNAP;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** 지금 시각 → 하루 분 (한국 시간) */
export function nowDayMin(now: Date, dayStartHour: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return clockToDayMin(h * 60 + m, dayStartHour);
}

/** 하루 기준 시각을 바꿀 때 저장된 분을 같은 시계 시각으로 옮긴다 */
export function shiftDayMin(dayMin: number, fromHour: number, toHour: number): number {
  return clockToDayMin(dayMinToClock(dayMin, fromHour), toHour);
}
