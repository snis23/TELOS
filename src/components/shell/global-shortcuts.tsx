"use client";

import { useRouter } from "next/navigation";
import { useThemeSetting } from "@/lib/data/theme-setting";
import { MAIN_NAV } from "@/lib/nav";
import { NAV_COMBOS, THEME_TOGGLE_COMBO } from "@/lib/shortcuts/keys";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

/** 어느 화면에서나 동작하는 단축키: Alt+1~5 메뉴 이동, Shift+T 다크 모드 */
export function GlobalShortcuts() {
  const router = useRouter();
  const { toggle } = useThemeSetting();
  useShortcut(NAV_COMBOS, (_event, index) => {
    const item = MAIN_NAV[index];
    if (item) router.push(item.href);
  });
  useShortcut(THEME_TOGGLE_COMBO, () => toggle());
  return null;
}
