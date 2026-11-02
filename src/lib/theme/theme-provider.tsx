"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

type ThemeApi = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  /** 이 기기에만 적용 (계정 저장은 useThemeSetting 이 한다) */
  applyLocal: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeApi | null>(null);

export function useTheme(): ThemeApi {
  const api = useContext(ThemeContext);
  if (!api) throw new Error("useTheme must be used inside <ThemeProvider>");
  return api;
}

function readStored(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function readDocumentTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // 첫 렌더 뒤에 기기 저장값과 기기 설정을 읽는다 (<head> 스크립트가 이미 색을 정해 둠)
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저에서만 알 수 있는 값 */
    setPreference(readStored());
    setSystemDark(media.matches);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved = hydrated ? resolveTheme(preference, systemDark) : readDocumentTheme();

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", resolved);
  }, [hydrated, resolved]);

  const applyLocal = useCallback((next: ThemePreference) => {
    setPreference(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 사생활 보호 모드 등에서는 저장하지 못해도 화면은 바뀐다
    }
  }, []);

  const api = useMemo(() => ({ preference, resolved, applyLocal }), [preference, resolved, applyLocal]);
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}
