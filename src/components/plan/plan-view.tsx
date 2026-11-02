"use client";

import { PageHeader } from "@/components/shell/page-header";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, useStoredTab } from "@/components/ui/tabs";
import { ProgressTable } from "./progress-table";
import { Roadmap } from "./roadmap";
import { WeeklyPlan } from "./weekly-plan";

const TABS = [
  { value: "roadmap", label: "로드맵" },
  { value: "week", label: "주간 계획" },
  { value: "progress", label: "진행표" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** 4.1 계획: 로드맵, 주간 계획, 진행표 탭 */
export function PlanView() {
  const [tab, setTab] = useStoredTab<Tab>("telos:plan-tab", ["roadmap", "week", "progress"], "roadmap");
  return (
    <>
      <PageHeader title="계획" />
      <Tabs label="계획" tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      <CardErrorBoundary>
        {tab === "roadmap" ? <Roadmap /> : tab === "week" ? <WeeklyPlan /> : <ProgressTable />}
      </CardErrorBoundary>
    </>
  );
}
