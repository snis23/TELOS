import { describe, expect, it } from "vitest";
import { reviewSummary } from "./review-summary";

describe("회독 요약 (6.5)", () => {
  it("단원 수와 회차별 체크 수", () => {
    const units = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id }));
    const c = (unit_id: string, r1: boolean, r2: boolean, r3 = false) => ({ unit_id, round1: r1, round2: r2, round3: r3, deleted_at: null });
    const checks = [c("a", true, true), c("b", true, true), c("c", true, false), c("d", true, false), c("zz", true, true)];
    expect(reviewSummary(units, checks).label).toBe("1회독 4/6 · 2회독 2/6 · 3회독 0/6");
  });
});
