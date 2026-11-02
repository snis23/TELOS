import { describe, expect, it } from "vitest";
import { formatStudyDateLong, getStudyDate } from "./study-date";

const kst = (s: string) => new Date(`${s}+09:00`);

describe("getStudyDate (5.1 하루 기준 시각)", () => {
  it("기준 6시: 05:59 는 전날, 06:00 은 그날", () => {
    expect(getStudyDate(kst("2026-11-02T05:59:59"))).toBe("2026-11-01");
    expect(getStudyDate(kst("2026-11-02T06:00:00"))).toBe("2026-11-02");
  });

  it("자정 직후와 밤늦게", () => {
    expect(getStudyDate(kst("2026-11-02T00:30:00"))).toBe("2026-11-01");
    expect(getStudyDate(kst("2026-11-02T23:59:00"))).toBe("2026-11-02");
  });

  it("기준 시각을 바꾸면 경계도 바뀐다", () => {
    expect(getStudyDate(kst("2026-11-02T04:30:00"), 4)).toBe("2026-11-02");
    expect(getStudyDate(kst("2026-11-02T03:59:00"), 4)).toBe("2026-11-01");
    expect(getStudyDate(kst("2026-11-02T00:00:00"), 0)).toBe("2026-11-02");
  });

  it("월말·연말 경계", () => {
    expect(getStudyDate(kst("2027-01-01T05:00:00"))).toBe("2026-12-31");
    expect(getStudyDate(kst("2026-03-01T05:00:00"))).toBe("2026-02-28");
  });

  it("기기 시간대와 상관없이 한국 시간 기준", () => {
    // UTC 2026-11-01 21:00 = 한국 11-02 06:00
    expect(getStudyDate(new Date("2026-11-01T21:00:00Z"))).toBe("2026-11-02");
    expect(getStudyDate(new Date("2026-11-01T20:59:00Z"))).toBe("2026-11-01");
  });

  it("잘못된 기준 시각은 거절", () => {
    expect(() => getStudyDate(new Date(), 24)).toThrow();
    expect(() => getStudyDate(new Date(), 1.5)).toThrow();
  });

  it("머리말 날짜 형식", () => {
    expect(formatStudyDateLong("2026-11-02")).toBe("11월 2일 월요일");
  });
});
