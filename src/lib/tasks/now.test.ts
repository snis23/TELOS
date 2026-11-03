import { describe, expect, it } from "vitest";
import { pickNowTask } from "./now";

const t = (p: Partial<{ id: string; done_at: string | null; start_min: number | null; end_min: number | null; slot_id: string | null; sort_order: number; must_do: boolean; deferred_count: number }>) => ({
  id: "x",
  done_at: null,
  start_min: null,
  end_min: null,
  slot_id: null,
  sort_order: 0,
  must_do: false,
  deferred_count: 0,
  ...p,
});

describe("지금 할 일", () => {
  it("지금 시간 블록 → 지금 차시 → 다음 블록 → 남은 할 일 순서", () => {
    const list = [
      t({ id: "later", start_min: 900, end_min: 960 }),
      t({ id: "now", start_min: 800, end_min: 860 }),
      t({ id: "slot", slot_id: "s1", sort_order: 1 }),
      t({ id: "plain", sort_order: 2 }),
    ];
    expect(pickNowTask(list, 830, "s1")).toEqual({ task: list[1], kind: "now" });
    expect(pickNowTask(list, 870, "s1")).toEqual({ task: list[2], kind: "now" });
    expect(pickNowTask(list, 870, null)).toEqual({ task: list[0], kind: "next" });
    expect(pickNowTask(list, 1000, null)).toEqual({ task: list[0], kind: "todo" });
  });

  it("꼭 하기·많이 미룬 일이 먼저, 다 끝내면 없음", () => {
    const list = [t({ id: "a", sort_order: 0 }), t({ id: "b", sort_order: 1, deferred_count: 2 }), t({ id: "c", sort_order: 2, must_do: true })];
    expect(pickNowTask(list, 0, null)?.task.id).toBe("c");
    expect(pickNowTask([t({ done_at: "x" })], 0, null)).toBeNull();
  });
});
