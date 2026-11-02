import { describe, expect, it } from "vitest";
import { examProgress, formatRange, itemProgress, studyDays, subjectProgress, todayPortion } from "./range";

const item = (start_no: number, end_no: number, done_amount: number) => ({ start_no, end_no, done_amount });

describe("범위 분배 (6.5)", () => {
  it("공부 가능일: 오늘부터 (시험일 − 총복습 − 1일)까지", () => {
    // 시험 11-20, 총복습 3일 → 11-16 까지. 11-02 ~ 11-16 = 15일
    expect(studyDays("2026-11-02", "2026-11-20", 3, [])).toBe(15);
  });

  it("공부 안 하는 요일 제외", () => {
    // 11-02(월) ~ 11-08(일): 토·일 빼면 5일
    expect(studyDays("2026-11-02", "2026-11-12", 3, [6, 7])).toBe(5);
  });

  it("하루 분량은 올림, 오늘 분량은 현재 위치부터", () => {
    // p.84~200 중 끝낸 양 0 → 117쪽 / 15일 = 7.8 → 8쪽
    const r = todayPortion(item(84, 200, 0), { today: "2026-11-02", examDate: "2026-11-20", reviewDays: 3, offWeekdays: [] });
    expect(r).toEqual({ kind: "portion", from: 84, to: 91, perDay: 8, days: 15 });
    expect(formatRange("page", 84, 91)).toBe("p.84–91");
  });

  it("미루면 남은 날에 자동으로 나눠진다 (끝낸 양으로 다시 계산)", () => {
    const r = todayPortion(item(84, 200, 8), { today: "2026-11-04", examDate: "2026-11-20", reviewDays: 3, offWeekdays: [] });
    // 109쪽 / 13일 = 8.38 → 9쪽, p.92 부터
    expect(r).toMatchObject({ kind: "portion", from: 92, to: 100, perDay: 9 });
  });

  it("공부 가능일 0 이하 → 총복습 기간", () => {
    expect(todayPortion(item(1, 50, 0), { today: "2026-11-17", examDate: "2026-11-20", reviewDays: 3, offWeekdays: [] })).toEqual({ kind: "review" });
    expect(todayPortion(item(1, 50, 0), { today: "2026-11-25", examDate: "2026-11-20", reviewDays: 3, offWeekdays: [] })).toEqual({ kind: "review" });
  });

  it("공부 안 하는 요일인 오늘은 분량 없음", () => {
    expect(todayPortion(item(1, 50, 0), { today: "2026-11-07", examDate: "2026-11-30", reviewDays: 3, offWeekdays: [6] }).kind).toBe("off");
  });

  it("끝낸 양이 전체보다 클 때: 다 끝난 것으로", () => {
    expect(itemProgress(item(1, 10, 15))).toBe(1);
    expect(todayPortion(item(1, 10, 15), { today: "2026-11-02", examDate: "2026-11-20", reviewDays: 3, offWeekdays: [] })).toEqual({ kind: "done" });
  });

  it("마지막 날에는 남은 양을 모두", () => {
    expect(todayPortion(item(1, 10, 3), { today: "2026-11-16", examDate: "2026-11-20", reviewDays: 3, offWeekdays: [] })).toMatchObject({ from: 4, to: 10 });
  });

  it("진행률: 항목 → 과목 평균 → 시험 평균", () => {
    expect(subjectProgress([item(1, 10, 5), item(1, 4, 4)])).toBe(0.75);
    const items = [
      { ...item(1, 10, 5), subject_id: "m" },
      { ...item(1, 4, 4), subject_id: "m" },
      { ...item(1, 2, 0), subject_id: "k" },
    ];
    expect(examProgress(items)).toBe(0.375);
    expect(examProgress([])).toBeNull();
  });

  it("단위별 표시", () => {
    expect(formatRange("unit", 3, 4)).toBe("3–4단원");
    expect(formatRange("chapter", 5, 5)).toBe("5장");
    expect(formatRange("problem", 12, 30)).toBe("12–30번");
  });
});
