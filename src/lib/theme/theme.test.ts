import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, resolveTheme, toggledPreference } from "./theme";

describe("테마 (3.6)", () => {
  it("기기 설정 따르기", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("Shift+T 는 지금 보이는 색의 반대", () => {
    expect(toggledPreference("dark")).toBe("light");
    expect(toggledPreference("light")).toBe("dark");
  });

  it("첫 화면 스크립트가 저장값으로 data-theme 을 정한다", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
