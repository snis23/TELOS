import { describe, expect, it } from "vitest";
import { MAIN_NAV, MORE_NAV, TAB_NAV, isMoreActive, isNavActive } from "./nav";

describe("메뉴 (4.1)", () => {
  it("사이드바 5개, 하단 탭 4개 + 더보기 2개", () => {
    expect(MAIN_NAV.map((n) => n.label)).toEqual(["오늘", "시험 대비", "계획", "학습", "기록"]);
    expect(TAB_NAV.map((n) => n.label)).toEqual(["오늘", "시험 대비", "계획", "학습"]);
    expect(MORE_NAV.map((n) => n.label)).toEqual(["기록", "설정"]);
  });

  it("선택된 메뉴 판별 (끝의 / 있든 없든)", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/plan/", "/")).toBe(false);
    expect(isNavActive("/plan", "/plan/")).toBe(true);
    expect(isNavActive("/learn/note/", "/learn/")).toBe(true);
    expect(isNavActive("/planner/", "/plan/")).toBe(false);
    expect(isMoreActive("/settings/")).toBe(true);
    expect(isMoreActive("/exam/")).toBe(false);
  });
});
