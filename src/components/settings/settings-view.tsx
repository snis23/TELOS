"use client";

import { PageHeader } from "@/components/shell/page-header";
import { BackupCard } from "./backup-card";
import { DayStartSetting } from "./day-start-setting";
import { HolidaySettings } from "./holiday-settings";
import { LogoutCard } from "./logout-card";
import { MaintenanceInfo } from "./maintenance-info";
import { PlanSettings } from "./plan-settings";
import { SubjectManager } from "./subject-manager";
import { ThemeSetting } from "./theme-setting";
import { TimetableSettings } from "./timetable-settings";
import { TrashCard } from "./trash-card";

/** 4.1 설정: 과목 관리, 학교 시간표, 공휴일, 테마, 하루 기준 시각, 휴지통, 백업, 로그아웃 */
export function SettingsView() {
  return (
    <>
      <PageHeader title="설정" />
      <div className="card-stack">
        <SubjectManager />
        <TimetableSettings />
        <HolidaySettings />
        <PlanSettings />
        <ThemeSetting />
        <DayStartSetting />
        <TrashCard />
        <BackupCard />
        <MaintenanceInfo />
        <LogoutCard />
      </div>
    </>
  );
}
