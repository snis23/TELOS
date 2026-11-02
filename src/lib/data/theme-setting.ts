"use client";

import { useCallback, useEffect } from "react";
import { useTheme } from "@/lib/theme/theme-provider";
import { toggledPreference, type ThemePreference } from "@/lib/theme/theme";
import { useProfile, useUpdateProfile } from "./profile";

/**
 * 테마는 계정에 저장해 모든 기기에 적용한다 (3.6).
 * 계정 값이 바뀌면(다른 기기에서 바꿈 포함) 이 기기에도 적용한다.
 */
export function useThemeSync() {
  const { data: profile } = useProfile();
  const { preference, applyLocal } = useTheme();
  const accountTheme = profile?.theme;

  useEffect(() => {
    if (accountTheme && accountTheme !== preference) applyLocal(accountTheme);
    // preference 를 넣으면 내가 막 바꾼 값이 저장 전에 되돌아갈 수 있어 계정 값만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTheme, applyLocal]);
}

export function useThemeSetting() {
  const { preference, resolved, applyLocal } = useTheme();
  const updateProfile = useUpdateProfile();

  const setTheme = useCallback(
    (next: ThemePreference) => {
      applyLocal(next);
      updateProfile.mutate({ theme: next });
    },
    [applyLocal, updateProfile],
  );

  const toggle = useCallback(() => setTheme(toggledPreference(resolved)), [resolved, setTheme]);

  return { preference, resolved, setTheme, toggle };
}
