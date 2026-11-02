import { describe, expect, it } from "vitest";
import { missedStreak, occursOn, recurrencesDue, ruleLabel } from "./recurrence";

describe("반복 생성 (5.6)", () => {
  it("매일", () => {
    const r = { rule: { type: "daily" as const }, start_date: "2026-11-02", end_date: null };
    expect(occursOn(r, "2026-11-02")).toBe(true);
    expect(occursOn(r, "2026-12-25")).toBe(true);
    expect(occursOn(r, "2026-11-01")).toBe(false);
  });

  it("요일 (1=월 … 7=일)", () => {
    const r = { rule: { type: "weekdays" as const, days: [1, 3, 5] }, start_date: "2026-11-01", end_date: null };
    expect(occursOn(r, "2026-11-02")).toBe(true); // 월
    expect(occursOn(r, "2026-11-03")).toBe(false); // 화
    expect(occursOn(r, "2026-11-04")).toBe(true); // 수
    expect(occursOn(r, "2026-11-08")).toBe(false); // 일
    expect(ruleLabel(r.rule)).toBe("월·수·금");
  });

  it("격주: 시작한 주부터 2주마다", () => {
    const r = { rule: { type: "biweekly" as const, days: [2] }, start_date: "2026-11-04", end_date: null };
    expect(occursOn(r, "2026-11-03")).toBe(false); // 시작 전
    expect(occursOn(r, "2026-11-10")).toBe(false); // 다음 주
    expect(occursOn(r, "2026-11-17")).toBe(true); // 2주 뒤
    expect(occursOn(r, "2026-12-01")).toBe(true); // 4주 뒤
    expect(ruleLabel(r.rule)).toBe("격주 화");
  });

  it("끝나는 날 이후에는 만들지 않는다", () => {
    const r = { rule: { type: "daily" as const }, start_date: "2026-11-01", end_date: "2026-11-05" };
    expect(occursOn(r, "2026-11-05")).toBe(true);
    expect(occursOn(r, "2026-11-06")).toBe(false);
  });

  it("같은 날 중복 없음: 이미 있는 반복은 건너뛴다", () => {
    const recs = [
      { id: "a", rule: { type: "daily" as const }, start_date: "2026-11-01", end_date: null },
      { id: "b", rule: { type: "daily" as const }, start_date: "2026-11-01", end_date: null },
    ];
    expect(recurrencesDue(recs, "2026-11-02", new Set(["a"])).map((r) => r.id)).toEqual(["b"]);
  });

  it("연속으로 못 한 횟수: 끝낸 날을 만나면 멈춘다", () => {
    const r = { rule: { type: "daily" as const }, start_date: "2026-10-25", end_date: null };
    expect(missedStreak(r, "2026-11-02", new Set(["2026-10-30"]))).toBe(2); // 10-31, 11-01
    expect(missedStreak(r, "2026-11-02", new Set(["2026-11-01"]))).toBe(0);
    expect(missedStreak(r, "2026-10-27", new Set())).toBe(2); // 10-25, 10-26 (시작 전은 세지 않음)
  });

  it("연속 못 한 횟수는 예정일만 센다", () => {
    const r = { rule: { type: "weekdays" as const, days: [1, 3, 5] }, start_date: "2026-10-01", end_date: null };
    // 11-02(월) 기준: 10-30(금) 못 함, 10-28(수) 함
    expect(missedStreak(r, "2026-11-02", new Set(["2026-10-28"]))).toBe(1);
  });
});
