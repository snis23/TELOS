import type { SchoolGradeRow } from "@/lib/supabase/database.types";

/**
 * 8.2 내신 5등급제
 * 1. 중간석차 = 석차 + (동석차 수 − 1) ÷ 2
 * 2. 누적 비율(%) = 중간석차 ÷ 수강자 수 × 100
 * 3. 10% 이하 1등급, 34% 이하 2등급, 66% 이하 3등급, 90% 이하 4등급, 나머지 5등급 (경계값은 위 등급)
 */
export function schoolGrade(rank: number, tieCount: number, totalStudents: number): number {
  const mid = rank + (Math.max(1, tieCount) - 1) / 2;
  const pct = (mid / totalStudents) * 100;
  // 부동소수 오차로 경계(예: 34.0000001)를 넘지 않게 작게 깎는다
  const p = Math.round(pct * 1e9) / 1e9;
  if (p <= 10) return 1;
  if (p <= 34) return 2;
  if (p <= 66) return 3;
  if (p <= 90) return 4;
  return 5;
}

/** 소수 둘째 자리 반올림 (0.005 → 0.01) */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type G = Pick<SchoolGradeRow, "credits" | "grade" | "deleted_at">;

/** 평균 등급 = Σ(학점 × 등급) ÷ Σ학점. 등급이 있는 과목만 넣는다. 소수 둘째 자리까지 */
export function averageGrade(rows: readonly G[]): number | null {
  const graded = rows.filter((r) => !r.deleted_at && r.grade !== null && r.grade !== undefined);
  const credits = graded.reduce((s, r) => s + r.credits, 0);
  if (credits === 0) return null;
  return round2(graded.reduce((s, r) => s + r.credits * (r.grade as number), 0) / credits);
}

export function semesterLabel(year: number, semester: number): string {
  return `${year}-${semester}`;
}

/** 목표까지 차이: 등급은 숫자가 작을수록 좋다 */
export function targetGap(current: number | null, target: number | null): { label: string; achieved: boolean } | null {
  if (current === null || target === null) return null;
  if (current <= target) return { label: "달성", achieved: true };
  return { label: `목표까지 ${current - target}등급`, achieved: false };
}

/** 지난번 대비: 등급은 숫자가 작아지면 오른 것 */
export function changeDirection(prev: number | null, cur: number | null, metric: "raw" | "percentile" | "grade"): "up" | "down" | "same" | null {
  if (prev === null || cur === null) return null;
  if (prev === cur) return "same";
  const better = metric === "grade" ? cur < prev : cur > prev;
  return better ? "up" : "down";
}

/** 모의고사 그래프 세로축 (8.3) */
export function mockAxis(metric: "raw" | "percentile" | "grade", maxScore: number, values: readonly number[]): { domain: [number, number]; reversed: boolean } {
  if (metric === "grade") return { domain: [1, 9], reversed: true };
  if (metric === "percentile") return { domain: values.some((v) => v < 50) ? [0, 100] : [50, 100], reversed: false };
  const half = maxScore / 2;
  return { domain: values.some((v) => v < half) ? [0, maxScore] : [half, maxScore], reversed: false };
}

/** 가로축 회차 "25.11", "26.3" */
export function roundShortLabel(year: number, month: number): string {
  return `${String(year).slice(2)}.${month}`;
}
