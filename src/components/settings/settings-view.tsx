"use client";

import { PageHeader } from "@/components/shell/page-header";
import { LogoutCard } from "./logout-card";
import { SubjectManager } from "./subject-manager";
import { ThemeSetting } from "./theme-setting";

/** 4.1 설정: 과목 관리, 학교 시간표, 공휴일, 테마, 하루 기준 시각, 휴지통, 로그아웃 */
export function SettingsView() {
  return (
    <>
      <PageHeader title="설정" />
      <div className="card-stack">
        <SubjectManager />
        <ThemeSetting />
        <LogoutCard />
      </div>
    </>
  );
}
