import { describe, expect, it } from "vitest";
import {
  examProgress,
  examProgressMap,
  itemsByDate,
  monthMatrix,
  roadmapCandidates,
  shiftMonth,
  subjectExamDate,
  subjectProgress,
} from "./roadmap";

const item = (p: Partial<{ id: string; dday_id: string; subject_id: string; study_date: string; done_at: string | null; round: number | null; deleted_at: string | null; sort_order: number }>) => ({
  id: "i",
  dday_id: "e",
  subject_id: "m",
  study_date: "2026-11-03",
  done_at: null,
  round: null,
  deleted_at: null,
  sort_order: 0,
  ...p,
});

describe("달력", () => {
  it("월요일 시작, 그 달을 덮는 주만", () => {
    const weeks = monthMatrix("2026-11");
    expect(weeks[0][0]).toEqual({ date: "2026-10-26", inMonth: false });
    expect(weeks[0][6]).toEqual({ date: "2026-11-01", inMonth: true });
    expect(weeks.at(-1)?.at(-1)?.date).toBe("2026-12-06");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(monthMatrix("2027-02").length).toBe(4);
  });

  it("달 넘기기", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-11", -11)).toBe("2025-12");
  });
});

describe("진행표·회독", () => {
  const items = [
    item({ id: "a", study_date: "2026-11-01", done_at: "x", round: 1 }),
    item({ id: "b", study_date: "2026-11-02", round: 1 }),
    item({ id: "c", study_date: "2026-11-05", round: 2 }),
    item({ id: "d", subject_id: "k", study_date: "2026-11-02", done_at: "x" }),
    item({ id: "z", study_date: "2026-11-02", deleted_at: "x" }),
  ];

  it("과목별: 끝낸 칸 ÷ 전체 칸, 오늘까지 계획 실현률, 회독별", () => {
    const [m, k, none] = subjectProgress(items, ["m", "k", "x"], "2026-11-03");
    expect(m).toMatchObject({ total: 3, done: 1, dueTotal: 2, dueDone: 1, dueRate: 0.5 });
    expect(m.rate).toBeCloseTo(1 / 3);
    expect(m.rounds).toEqual([
      { round: 1, total: 2, done: 1 },
      { round: 2, total: 1, done: 0 },
    ]);
    expect(k).toMatchObject({ total: 1, done: 1, rate: 1 });
    expect(none).toMatchObject({ total: 0, rate: null, dueRate: null });
  });

  it("시험 진행률과 시험별 묶음 (지운 칸 제외)", () => {
    expect(examProgress(items)).toBe(0.5);
    expect(examProgress([])).toBeNull();
    const map = examProgressMap([...items, item({ id: "o", dday_id: "e2", done_at: "x" })]);
    expect(map.get("e")).toBe(0.5);
    expect(map.get("e2")).toBe(1);
  });

  it("과목별 시험 날짜: 없으면 시험 첫날", () => {
    const exam = { id: "e", date: "2026-12-08" };
    const rows = [{ dday_id: "e", subject_id: "m", exam_date: "2026-12-10", deleted_at: null }];
    expect(subjectExamDate(exam, "m", rows)).toBe("2026-12-10");
    expect(subjectExamDate(exam, "k", rows)).toBe("2026-12-08");
  });

  it("날짜별 묶음은 순서대로", () => {
    const map = itemsByDate([item({ id: "2", sort_order: 1 }), item({ id: "1", sort_order: 0 }), item({ id: "x", deleted_at: "x" })]);
    expect(map.get("2026-11-03")?.map((i) => i.id)).toEqual(["1", "2"]);
  });
});

describe("오늘 할 일로 가져올 로드맵 칸", () => {
  it("이날 → 밀린 계획 → 다가오는 7일, 끝냈거나 이미 넣은 칸은 빠진다", () => {
    const list = [
      item({ id: "t", study_date: "2026-11-03" }),
      item({ id: "o2", study_date: "2026-11-02" }),
      item({ id: "o1", study_date: "2026-11-01" }),
      item({ id: "u", study_date: "2026-11-06" }),
      item({ id: "far", study_date: "2026-11-20" }),
      item({ id: "done", study_date: "2026-11-03", done_at: "x" }),
      item({ id: "linked", study_date: "2026-11-03" }),
    ];
    const c = roadmapCandidates(list, new Set(["linked"]), "2026-11-03");
    expect(c.today.map((i) => i.id)).toEqual(["t"]);
    expect(c.overdue.map((i) => i.id)).toEqual(["o1", "o2"]);
    expect(c.upcoming.map((i) => i.id)).toEqual(["u"]);
  });
});
