import { describe, expect, it } from "vitest";
import { averageGrade, changeDirection, mockAxis, round2, roundShortLabel, schoolGrade, targetGap } from "./grades";

describe("5등급 계산 (8.2)", () => {
  it("누적 10%, 34%, 66%, 90% 경계는 위 등급", () => {
    expect(schoolGrade(10, 1, 100)).toBe(1);
    expect(schoolGrade(11, 1, 100)).toBe(2);
    expect(schoolGrade(34, 1, 100)).toBe(2);
    expect(schoolGrade(35, 1, 100)).toBe(3);
    expect(schoolGrade(66, 1, 100)).toBe(3);
    expect(schoolGrade(67, 1, 100)).toBe(4);
    expect(schoolGrade(90, 1, 100)).toBe(4);
    expect(schoolGrade(91, 1, 100)).toBe(5);
  });

  it("동석차가 있으면 중간석차로", () => {
    // 석차 9, 동석차 3 → 중간석차 10 → 10% → 1등급
    expect(schoolGrade(9, 3, 100)).toBe(1);
    // 석차 9, 동석차 4 → 10.5 → 2등급
    expect(schoolGrade(9, 4, 100)).toBe(2);
    // 경계 34%: 수강자 50명, 석차 17 → 34% → 2등급
    expect(schoolGrade(17, 1, 50)).toBe(2);
    expect(schoolGrade(16, 3, 50)).toBe(2); // 17 → 34%
    expect(schoolGrade(17, 2, 50)).toBe(3); // 17.5 → 35%
  });

  it("부동소수 오차에도 경계 유지", () => {
    // 33/97*100 = 34.02 → 3등급, 1/3 등 비율에서도 안정
    expect(schoolGrade(33, 1, 97)).toBe(3);
    expect(schoolGrade(29, 1, 290)).toBe(1);
  });
});

describe("평균 등급", () => {
  it("학점 가중, 등급 없는 과목 제외, 소수 둘째 자리 반올림", () => {
    const rows = [
      { credits: 4, grade: 1, deleted_at: null },
      { credits: 3, grade: 2, deleted_at: null },
      { credits: 2, grade: null, deleted_at: null },
      { credits: 3, grade: 3, deleted_at: null },
    ];
    // (4 + 6 + 9) / 10 = 1.9
    expect(averageGrade(rows)).toBe(1.9);
    expect(averageGrade([{ credits: 3, grade: 1, deleted_at: null }, { credits: 3, grade: 2, deleted_at: null }, { credits: 1, grade: 2, deleted_at: null }])).toBe(1.57);
    expect(averageGrade([{ credits: 2, grade: null, deleted_at: null }])).toBeNull();
  });

  it("반올림", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.344)).toBe(2.34);
    expect(round2(2.345)).toBe(2.35);
  });
});

describe("모의고사 (8.3)", () => {
  it("세로축 범위", () => {
    expect(mockAxis("raw", 100, [80, 92])).toEqual({ domain: [50, 100], reversed: false });
    expect(mockAxis("raw", 100, [40, 92])).toEqual({ domain: [0, 100], reversed: false });
    expect(mockAxis("raw", 50, [30])).toEqual({ domain: [25, 50], reversed: false });
    expect(mockAxis("percentile", 100, [60])).toEqual({ domain: [50, 100], reversed: false });
    expect(mockAxis("percentile", 100, [40])).toEqual({ domain: [0, 100], reversed: false });
    expect(mockAxis("grade", 100, [3])).toEqual({ domain: [1, 9], reversed: true });
  });
  it("지난번 대비: 등급은 숫자가 작아지면 오른 것", () => {
    expect(changeDirection(3, 2, "grade")).toBe("up");
    expect(changeDirection(80, 70, "raw")).toBe("down");
    expect(changeDirection(80, 80, "raw")).toBe("same");
  });
  it("회차 표시와 목표", () => {
    expect(roundShortLabel(2025, 11)).toBe("25.11");
    expect(roundShortLabel(2026, 3)).toBe("26.3");
    expect(targetGap(3, 2)).toEqual({ label: "목표까지 1등급", achieved: false });
    expect(targetGap(2, 2)).toEqual({ label: "달성", achieved: true });
  });
});
