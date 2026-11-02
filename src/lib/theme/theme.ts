/** 3.6 다크 모드: 라이트 / 다크 / 기기 설정 따르기(기본값) */
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME: ThemePreference = "system";

/** 계정 설정을 받기 전에 첫 화면 색을 정하려고 기기에도 저장해 둔다 */
export const THEME_STORAGE_KEY = "telos:theme";

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "라이트",
  dark: "다크",
  system: "기기 설정 따르기",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Shift+T, 사이드바 스위치: 지금 보이는 색의 반대로 바꾼다 */
export function toggledPreference(current: ResolvedTheme): ThemePreference {
  return current === "dark" ? "light" : "dark";
}

/**
 * 페이지가 그려지기 전에 <html data-theme> 를 정하는 스크립트 (깜빡임 방지).
 * <head> 안에서 가장 먼저 실행된다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;
