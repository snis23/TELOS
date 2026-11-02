"use client";

import { PageHeader } from "@/components/shell/page-header";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, useStoredTab } from "@/components/ui/tabs";
import { ProgressBoard } from "./progress-board";
import { WeeklyPlan } from "./weekly-plan";

const TABS = [
  { value: "week", label: "주간 계획" },
  { value: "progress", label: "진행표" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** 4.1 계획: 주간 계획, 진행표(시험 대비 로드맵 진행) 탭 */
export function PlanView() {
  const [tab, setTab] = useStoredTab<Tab>("telos:plan-tab", ["week", "progress"], "week");
  return (
    <>
      <PageHeader title="계획" />
      <Tabs label="계획" tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      <CardErrorBoundary>{tab === "week" ? <WeeklyPlan /> : <ProgressBoard />}</CardErrorBoundary>
    </>
  );
}
