import type { ReviewCheckRow, UnitRow } from "@/lib/supabase/database.types";

/** 회독 요약: "1회독 4/6 · 2회독 2/6 · 3회독 0/6" (6.5) */
export function reviewSummary(
  units: readonly Pick<UnitRow, "id">[],
  checks: readonly Pick<ReviewCheckRow, "unit_id" | "round1" | "round2" | "round3" | "deleted_at">[],
): { rounds: [number, number, number]; total: number; label: string } {
  const ids = new Set(units.map((u) => u.id));
  const live = checks.filter((c) => !c.deleted_at && ids.has(c.unit_id));
  const rounds: [number, number, number] = [
    live.filter((c) => c.round1).length,
    live.filter((c) => c.round2).length,
    live.filter((c) => c.round3).length,
  ];
  const total = units.length;
  return { rounds, total, label: rounds.map((n, i) => `${i + 1}회독 ${n}/${total}`).join(" · ") };
}
