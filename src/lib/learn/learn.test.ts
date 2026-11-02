import { describe, expect, it } from "vitest";
import { parseBulkCards, studyOrder } from "./cards";
import { defaultRoundName, groupNotes, noteSummary, photoPath } from "./notes";

describe("암기 카드 (7.4)", () => {
  it("여러 장 한 번에: 형식이 틀린 줄 번호를 알려 준다", () => {
    const r = parseBulkCards("apple | 사과\n\nbanana|바나나\n잘못된 줄\n | 앞면 없음\ncherry | 체리 | 버찌");
    expect(r.cards).toEqual([
      { front: "apple", back: "사과" },
      { front: "banana", back: "바나나" },
      { front: "cherry", back: "체리 | 버찌" },
    ]);
    expect(r.errorLines).toEqual([4, 5]);
  });

  it("글자 수 제한 (앞면 200, 뒷면 500)", () => {
    expect(parseBulkCards(`${"가".repeat(201)} | 뒤`).errorLines).toEqual([1]);
    expect(parseBulkCards(`앞 | ${"가".repeat(501)}`).errorLines).toEqual([1]);
  });

  it("외우기 순서: 모름 먼저, 모름만 보기", () => {
    const cards = [
      { id: 1, known: true },
      { id: 2, known: false },
      { id: 3, known: true },
      { id: 4, known: false },
    ];
    const order = studyOrder(cards, false, () => 0.3);
    expect(order.slice(0, 2).every((c) => !c.known)).toBe(true);
    expect(order).toHaveLength(4);
    expect(studyOrder(cards, true).every((c) => !c.known)).toBe(true);
  });
});

describe("오답노트 (7장)", () => {
  const note = (over: Record<string, unknown>) => ({
    kind: "school" as const,
    unit_id: null as string | null,
    mock_round_id: null as string | null,
    created_at: "2026-11-01T00:00:00Z",
    solved_at: null as string | null,
    reason: "concept" as "concept" | "slip" | "time",
    deleted_at: null as string | null,
    ...over,
  });

  it("요약: 다시 풀 문제, 해결, 많이 틀린 이유", () => {
    const s = noteSummary([note({}), note({ reason: "slip", solved_at: "x" }), note({ reason: "slip" }), note({ reason: "slip", deleted_at: "x" })]);
    expect(s).toEqual({ unsolved: 2, solved: 1, topReason: "slip" });
  });

  it("내신은 단원 순서, 모의고사는 최신 회차부터", () => {
    const units = [
      { id: "u2", name: "로그", sort_order: 1 },
      { id: "u1", name: "지수", sort_order: 0 },
    ];
    const rounds = [
      { id: "r1", name: "2026년 6월 모의고사", year: 2026, month: 6 },
      { id: "r2", name: "2026년 10월 모의고사", year: 2026, month: 10 },
    ];
    const school = groupNotes([note({ unit_id: "u2" }), note({ unit_id: "u1" }), note({ unit_id: "u1" })], "school", units, rounds);
    expect(school.map((g) => [g.label, g.notes.length])).toEqual([
      ["지수 단원", 2],
      ["로그 단원", 1],
    ]);
    const mock = groupNotes([note({ kind: "mock", mock_round_id: "r1" }), note({ kind: "mock", mock_round_id: "r2" })], "mock", units, rounds);
    expect(mock.map((g) => g.label)).toEqual(["2026년 10월 모의고사", "2026년 6월 모의고사"]);
  });

  it("회차 기본 이름, 사진 경로", () => {
    expect(defaultRoundName(2026, 10)).toBe("2026년 10월 모의고사");
    expect(photoPath("u", "n", "p")).toBe("u/n/p.jpg");
  });
});
