import { describe, expect, it } from "vitest";
import { bulkDeferTargets, deferLabel, deferLevel, sortTasks, staleTasks } from "./defer";

const base = {
  id: "x",
  source: "manual" as "manual" | "recurrence" | "range" | "goal",
  deferred_count: 0,
  missed_streak: 0,
  must_do: false,
  done_at: null as string | null,
  sort_order: 0,
  created_at: "2026-11-01T00:00:00Z",
  study_date: "2026-11-02",
  deleted_at: null as string | null,
};
const t = (over: Partial<typeof base>) => ({ ...base, ...over });

describe("미루기 강조 단계 (5.7)", () => {
  it("0, 1, 2, 3 이상", () => {
    expect(deferLevel(t({ deferred_count: 0 }))).toBe(0);
    expect(deferLevel(t({ deferred_count: 1 }))).toBe(1);
    expect(deferLevel(t({ deferred_count: 2 }))).toBe(2);
    expect(deferLevel(t({ deferred_count: 3 }))).toBe(3);
    expect(deferLevel(t({ deferred_count: 7 }))).toBe(3);
  });

  it("반복 할 일은 연속으로 못 한 횟수를 쓴다", () => {
    expect(deferLevel(t({ source: "recurrence", deferred_count: 0, missed_streak: 2 }))).toBe(2);
    expect(deferLevel(t({ source: "recurrence", deferred_count: 5, missed_streak: 0 }))).toBe(0);
    expect(deferLabel(t({ source: "recurrence", missed_streak: 1 }))).toBe("지난번에 못 함");
    expect(deferLabel(t({ deferred_count: 1 }))).toBe("어제에서 넘어옴");
    expect(deferLabel(t({ deferred_count: 4 }))).toBe("4번 미룸");
    expect(deferLabel(t({}))).toBeNull();
  });

  it("정렬: 3번 이상·오늘 꼭 하기 → 2번 → 나머지(정한 순서) → 끝낸 일", () => {
    const list = [
      t({ id: "a", sort_order: 0 }),
      t({ id: "b", sort_order: 1, deferred_count: 2 }),
      t({ id: "c", sort_order: 2, deferred_count: 3 }),
      t({ id: "d", sort_order: 3, done_at: "2026-11-02T01:00:00Z", deferred_count: 5 }),
      t({ id: "e", sort_order: 4, must_do: true }),
      t({ id: "f", sort_order: 5, deferred_count: 1 }),
    ];
    expect(sortTasks(list).map((x) => x.id)).toEqual(["c", "e", "b", "a", "f", "d"]);
  });

  it("한 번에 넘기기 대상: 반복·범위·오늘 꼭 하기·끝낸 일 제외", () => {
    const list = [
      t({ id: "a" }),
      t({ id: "b", source: "recurrence" }),
      t({ id: "c", must_do: true }),
      t({ id: "d", done_at: "x" }),
      t({ id: "e", source: "range" }),
      t({ id: "f", source: "goal" }),
    ];
    expect(bulkDeferTargets(list).map((x) => x.id)).toEqual(["a", "f"]);
  });

  it("지난 할 일: 지난 날짜, 안 끝낸 일반 할 일", () => {
    const list = [
      t({ id: "a", study_date: "2026-11-01" }),
      t({ id: "b", study_date: "2026-11-02" }),
      t({ id: "c", study_date: "2026-10-30", done_at: "x" }),
      t({ id: "d", study_date: "2026-10-30", source: "recurrence" }),
    ];
    expect(staleTasks(list, "2026-11-02").map((x) => x.id)).toEqual(["a"]);
  });
});
