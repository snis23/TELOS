"use client";

import { PageHeader } from "@/components/shell/page-header";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, useStoredTab } from "@/components/ui/tabs";
import { GradeCalculator } from "./calculator";
import { MockScores } from "./mock-scores";
import { Records } from "./records";
import { SchoolGrades } from "./school-grades";
import { Targets } from "./targets";

const TABS = [
  { value: "school", label: "내신" },
  { value: "mock", label: "모의고사" },
  { value: "calc", label: "내신 계산기" },
  { value: "target", label: "목표 등급" },
  { value: "record", label: "생기부" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** 4.1 성적: 내신, 모의고사, 내신 계산기, 목표 등급, 생기부 탭 */
export function GradeView() {
  const [tab, setTab] = useStoredTab<Tab>("telos:grade-tab", ["school", "mock", "calc", "target", "record"], "school");
  return (
    <>
      <PageHeader title="성적" />
      <Tabs label="성적" tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      <CardErrorBoundary>
        {tab === "school" ? <SchoolGrades /> : tab === "mock" ? <MockScores /> : tab === "calc" ? <GradeCalculator /> : tab === "target" ? <Targets /> : <Records />}
      </CardErrorBoundary>
    </>
  );
}
