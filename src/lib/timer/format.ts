const pad = (n: number) => String(n).padStart(2, "0");

/** 1시간 2분 3초 → "01:02:03" (타이머 큰 숫자) */
export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** "2:34:10" (오늘 순공) */
export function formatHMSShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** "2:34" (과목 칩의 오늘 누적 h:mm) */
export function formatHM(totalSeconds: number): string {
  const m = Math.max(0, Math.floor(totalSeconds / 60));
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
}

/** "35분", 1시간이 넘으면 "1시간 5분" (쪽잠 합계) */
export function formatDurationKo(totalSeconds: number): string {
  const m = Math.max(0, Math.floor(totalSeconds / 60));
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}
