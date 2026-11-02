import { describe, expect, it } from "vitest";
import { assignLanes, matchSlot, moveBlock, resizeBlock, segmentsOf } from "./grid";
import { currentSlot, timetableForDate } from "./resolve";
import { formatDayMin, nowDayMin, shiftDayMin, snap } from "./time";

const data = {
  timetables: [
    { id: "wd", default_for: "weekday" as const, deleted_at: null },
    { id: "we", default_for: "weekend" as const, deleted_at: null },
    { id: "exam", default_for: "none" as const, deleted_at: null },
  ],
  holidays: [{ date: "2026-12-25", deleted_at: null }],
  dateTimetables: [
    { date: "2026-11-04", timetable_id: "exam", deleted_at: null },
    { date: "2026-12-25", timetable_id: "exam", deleted_at: null },
  ],
};

describe("시간표 판별 (5.10)", () => {
  it("평일, 주말", () => {
    expect(timetableForDate("2026-11-02", data)).toBe("wd"); // 월
    expect(timetableForDate("2026-11-07", data)).toBe("we"); // 토
    expect(timetableForDate("2026-11-08", data)).toBe("we"); // 일
  });

  it("공휴일은 주말·공휴일 시간표", () => {
    expect(timetableForDate("2026-10-09", { ...data, holidays: [{ date: "2026-10-09", deleted_at: null }] })).toBe("we");
  });

  it("날짜별 지정이 가장 먼저 (공휴일보다도)", () => {
    expect(timetableForDate("2026-11-04", data)).toBe("exam");
    expect(timetableForDate("2026-12-25", data)).toBe("exam");
  });

  it("지운 지정은 무시", () => {
    const d2 = { ...data, dateTimetables: [{ date: "2026-11-04", timetable_id: "exam", deleted_at: "x" }] };
    expect(timetableForDate("2026-11-04", d2)).toBe("wd");
  });

  it("지금 일정", () => {
    const slots = [
      { start_min: 820, end_min: 900, name: "야자 1차시" },
      { start_min: 900, end_min: 980, name: "야자 2차시" },
    ];
    expect(currentSlot(slots, 850)?.name).toBe("야자 1차시");
    expect(currentSlot(slots, 900)?.name).toBe("야자 2차시");
    expect(currentSlot(slots, 1000)).toBeNull();
  });
});

describe("10분 칸 (5.11)", () => {
  it("하루 분 ↔ 시각, 자정 넘김", () => {
    expect(formatDayMin(820, 6)).toBe("19:40");
    expect(formatDayMin(1110, 6)).toBe("00:30");
    expect(snap(17)).toBe(20);
    expect(snap(14)).toBe(10);
    expect(snap(19, "floor")).toBe(10);
    expect(nowDayMin(new Date("2026-11-02T12:35:00Z"), 6)).toBe(15 * 60 + 35); // 한국 21:35
  });

  it("자정을 넘는 블록도 한 값으로 이어 그린다", () => {
    // 23:30 ~ 00:40 (기준 6시: 1050 ~ 1120)
    const segs = segmentsOf({ id: "a", start: 1050, end: 1120 });
    expect(segs).toEqual([
      { id: "a", row: 17, from: 30, to: 60, first: true, last: false },
      { id: "a", row: 18, from: 0, to: 40, first: false, last: true },
    ]);
  });

  it("한 시간을 넘으면 다음 줄에 이어서", () => {
    expect(segmentsOf({ id: "a", start: 820, end: 900 }).map((s) => [s.row, s.from, s.to])).toEqual([
      [13, 40, 60],
      [14, 0, 60],
    ]);
  });

  it("겹치는 블록은 칸을 나눠 나란히", () => {
    const lanes = assignLanes([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 30, end: 90 },
      { id: "c", start: 60, end: 120 },
      { id: "d", start: 200, end: 230 },
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("c")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("d")).toEqual({ lane: 0, lanes: 1 });
  });

  it("옮기기·길이 바꾸기는 10분 칸에 맞춘다", () => {
    expect(moveBlock({ id: "a", start: 100, end: 160 }, 237, 12)).toEqual({ start: 230, end: 290 });
    expect(moveBlock({ id: "a", start: 100, end: 160 }, 1439, 0)).toEqual({ start: 1380, end: 1440 });
    expect(moveBlock({ id: "a", start: 100, end: 160 }, -20, 0)).toEqual({ start: 0, end: 60 });
    expect(resizeBlock({ id: "a", start: 100, end: 160 }, 104)).toEqual({ start: 100, end: 110 });
    expect(resizeBlock({ id: "a", start: 100, end: 160 }, 213)).toEqual({ start: 100, end: 210 });
  });

  it("시간 블록과 차시 배정: 정확히 맞으면 배정, 벗어나면 해제", () => {
    const slots = [{ id: "y1", start_min: 820, end_min: 900 }];
    expect(matchSlot(820, 900, slots)?.id).toBe("y1");
    expect(matchSlot(830, 900, slots)).toBeNull();
    expect(matchSlot(820, 910, slots)).toBeNull();
  });

  it("하루 기준 시각을 바꾸면 같은 시계 시각으로 옮긴다", () => {
    // 기준 6시의 19:40(820) → 기준 5시면 880
    expect(shiftDayMin(820, 6, 5)).toBe(880);
    expect(formatDayMin(shiftDayMin(820, 6, 5), 5)).toBe("19:40");
  });
});
