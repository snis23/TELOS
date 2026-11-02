import { describe, expect, it } from "vitest";
import { ddayLabel, hasUrgent, prepPercent, selectHomeDdays, urgency } from "./dday";

const d = (id: string, date: string, over: Record<string, unknown> = {}) => ({
  id,
  date,
  type: "exam" as const,
  status: "todo" as const,
  pinned: false,
  pin_order: 0,
  deleted_at: null as string | null,
  ...over,
});

describe("홈 D-day 선택 (5.3)", () => {
  const today = "2026-11-02";

  it("고정 우선(고정 순서), 나머지는 날짜순, 최대 4개", () => {
    const list = [
      d("a", "2026-11-05"),
      d("b", "2026-12-20", { pinned: true, pin_order: 1 }),
      d("c", "2026-11-30", { pinned: true, pin_order: 0 }),
      d("e", "2026-11-03"),
      d("f", "2026-11-10"),
    ];
    expect(selectHomeDdays(list, today).map((x) => x.id)).toEqual(["c", "b", "e", "a"]);
  });

  it("지난 일정과 완료한 수행평가는 뺀다", () => {
    const list = [
      d("past", "2026-11-01", { pinned: true }),
      d("done", "2026-11-04", { type: "performance", status: "done" }),
      d("todayExam", "2026-11-02"),
      d("deleted", "2026-11-04", { deleted_at: "x" }),
    ];
    expect(selectHomeDdays(list, today).map((x) => x.id)).toEqual(["todayExam"]);
  });

  it("D-day 숫자와 색 단계", () => {
    expect(ddayLabel("2026-11-02", today)).toBe("D-DAY");
    expect(ddayLabel("2026-11-07", today)).toBe("D-5");
    expect(urgency("2026-11-09", today)).toBe("urgent"); // 7일
    expect(urgency("2026-11-10", today)).toBe("warn"); // 8일
    expect(urgency("2026-11-16", today)).toBe("warn"); // 14일
    expect(urgency("2026-11-17", today)).toBe("normal"); // 15일
  });

  it("7일 이내 D-day 가 있으면 시험 메뉴 점", () => {
    expect(hasUrgent([d("a", "2026-11-09")], today)).toBe(true);
    expect(hasUrgent([d("a", "2026-11-10")], today)).toBe(false);
  });

  it("준비율: 시험은 범위 진행률, 수행평가는 상태, 기타는 숨김", () => {
    expect(prepPercent({ type: "exam", status: "todo", prep_percent: null }, 0.6)).toBe(60);
    expect(prepPercent({ type: "performance", status: "todo", prep_percent: 40 }, null)).toBe(0);
    expect(prepPercent({ type: "performance", status: "doing", prep_percent: 40 }, null)).toBe(40);
    expect(prepPercent({ type: "performance", status: "done", prep_percent: 40 }, null)).toBe(100);
    expect(prepPercent({ type: "etc", status: "todo", prep_percent: null }, null)).toBeNull();
  });
});
