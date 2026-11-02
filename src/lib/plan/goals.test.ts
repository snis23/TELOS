import { describe, expect, it } from "vitest";
import { clampMonthDay, goalProgress, isPastGoal, monthRange, semesterOf, weekRange } from "./goals";

const g = (id: string, over: Record<string, unknown> = {}) => ({ id, parent_id: null as string | null, done_at: null as string | null, deleted_at: null as string | null, ...over });
const t = (goal_id: string, done: boolean) => ({ goal_id, done_at: done ? "x" : null, deleted_at: null });

describe("로드맵 진행률 (6.2)", () => {
  it("하위 목표가 있으면 완료한 하위 목표 비율", () => {
    const goals = [g("p"), g("a", { parent_id: "p", done_at: "x" }), g("b", { parent_id: "p" })];
    expect(goalProgress(goals[0], goals, [t("p", true)])).toBe(0.5);
  });
  it("없으면 연결된 할 일의 완료 비율", () => {
    expect(goalProgress(g("p"), [g("p")], [t("p", true), t("p", false), t("p", false), t("p", true)])).toBe(0.5);
  });
  it("둘 다 없으면 직접 체크", () => {
    expect(goalProgress(g("p"), [], [])).toBe(0);
    expect(goalProgress(g("p", { done_at: "x" }), [], [])).toBe(1);
  });
  it("지운 하위 목표는 세지 않는다", () => {
    const goals = [g("p"), g("a", { parent_id: "p", done_at: "x" }), g("b", { parent_id: "p", deleted_at: "x" })];
    expect(goalProgress(goals[0], goals, [])).toBe(1);
  });
  it("지난 목표", () => {
    expect(isPastGoal({ end_date: "2026-11-01", done_at: null }, "2026-11-02")).toBe(true);
    expect(isPastGoal({ end_date: "2026-11-01", done_at: "x" }, "2026-11-02")).toBe(false);
  });
});

describe("기간 계산", () => {
  it("주는 월요일부터", () => {
    expect(weekRange("2026-11-05")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(weekRange("2026-11-08")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
  });
  it("월 범위", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
  it("학기: 1학기 3/1~7/31, 2학기 8/1~다음 해 2월 말일", () => {
    const p = { sem1_start: "03-01", sem1_end: "07-31", sem2_start: "08-01", sem2_end: "02-29" };
    expect(semesterOf("2026-11-02", p)).toEqual({ semester: 2, start: "2026-08-01", end: "2027-02-28" });
    expect(semesterOf("2027-02-10", p)).toEqual({ semester: 2, start: "2026-08-01", end: "2027-02-28" });
    expect(semesterOf("2028-02-29", p)).toEqual({ semester: 2, start: "2027-08-01", end: "2028-02-29" });
    expect(semesterOf("2027-04-01", p)).toEqual({ semester: 1, start: "2027-03-01", end: "2027-07-31" });
    expect(clampMonthDay(2027, "02-29")).toBe("2027-02-28");
  });
});
