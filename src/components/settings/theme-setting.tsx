"use client";

import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useThemeSetting } from "@/lib/data/theme-setting";
import { THEME_LABELS, THEME_PREFERENCES } from "@/lib/theme/theme";

/** 3.6 테마: 라이트 / 다크 / 기기 설정 따르기. 계정에 저장해 모든 기기에 적용 */
export function ThemeSetting() {
  const { preference, setTheme } = useThemeSetting();
  return (
    <Card title="테마">
      <Segmented
        label="테마"
        value={preference}
        options={THEME_PREFERENCES.map((value) => ({ value, label: THEME_LABELS[value] }))}
        onChange={setTheme}
      />
    </Card>
  );
}
