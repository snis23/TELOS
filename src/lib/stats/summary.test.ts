import { describe, expect, it } from "vitest";
import { deferralAnalysis, executionRate, grassDays, grassLevel, periodRange, streak, todayPlanned, totalsFromStats } from "./summary";

describe("기록 화면 (8.1)", () => {
  it("daily_stats → 날짜별 합계", () => {
    const m = totalsFromStats([
      { study_date: "2026-11-01", subject_id: "m", study_seconds: 3600, nap_seconds: 0, nap_count: 0, planned_tasks: 0, done_tasks: 0 },
      { study_date: "2026-11-01", subject_id: null, study_seconds: 0, nap_seconds: 900, nap_count: 1, planned_tasks: 5, done_tasks: 3 },
    ]);
    expect(m.get("2026-11-01")).toMatchObject({ study: 3600, nap: 900, napCount: 1, planned: 5, done: 3 });
  });

  it("기간", () => {
    expect(periodRange("week", "2026-11-05")).toEqual({ from: "2026-11-02", to: "2026-11-05" });
    expect(periodRange("month", "2026-11-05")).toEqual({ from: "2026-11-01", to: "2026-11-05" });
  });

  it("실행률: 넘긴 할 일은 원래 날짜에서도 분모에", () => {
    const r = todayPlanned(
      [
        { id: "a", done_at: "x", deleted_at: null },
        { id: "b", done_at: null, deleted_at: null },
      ],
      [{ id: "d1", task_id: "c" }],
    );
    expect(r).toEqual({ planned: 3, done: 1 });
    expect(executionRate(3, 1)).toBeCloseTo(1 / 3);
    expect(executionRate(0, 0)).toBeNull();
  });

  it("잔디 단계와 칸", () => {
    expect([0, 1, 3599, 3600, 3 * 3600 - 1, 3 * 3600, 5 * 3600].map(grassLevel)).toEqual([0, 1, 1, 2, 2, 3, 4]);
    const g = grassDays("2026-11-04");
    expect(g).toHaveLength(16);
    expect(g[15][0]).toBe("2026-11-02");
    expect(g[0][0]).toBe("2026-07-20");
  });

  it("연속 달성일: 오늘(또는 어제)까지", () => {
    const m = new Map([
      ["2026-10-30", 3600],
      ["2026-10-31", 1800],
      ["2026-11-01", 4000],
      ["2026-11-02", 600],
    ]);
    expect(streak(m, "2026-11-02")).toBe(3); // 오늘은 30분 미만이라 어제까지
    expect(streak(new Map([...m, ["2026-11-02", 2000]]), "2026-11-02")).toBe(4);
    expect(streak(m, "2026-11-04")).toBe(0);
  });

  it("미루기 분석", () => {
    const r = deferralAnalysis(
      [
        { title: "영단어", subject_id: "e", from_date: "2026-11-01" },
        { title: "영단어", subject_id: "e", from_date: "2026-10-31" },
        { title: "수학", subject_id: "m", from_date: "2026-10-31" },
        { title: "오래됨", subject_id: "m", from_date: "2026-09-01" },
      ],
      [
        { recurrence_id: "r", done_at: null, study_date: "2026-11-01", deleted_at: null },
        { recurrence_id: "r", done_at: "x", study_date: "2026-10-31", deleted_at: null },
        { recurrence_id: "r", done_at: null, study_date: "2026-11-02", deleted_at: null },
      ],
      "2026-11-02",
    );
    expect(r.total).toBe(3);
    expect(r.bySubject.get("e")).toBe(2);
    expect(r.top[0]).toEqual(["영단어", 2]);
    expect(r.recurrenceMissed.get("r")).toEqual({ total: 2, missed: 1 });
  });
});
