"use client";

import { PageHeader } from "@/components/shell/page-header";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, useStoredTab } from "@/components/ui/tabs";
import { DecksScreen } from "./decks-screen";
import { NotesScreen } from "./notes-screen";

const TABS = [
  { value: "notes", label: "오답노트" },
  { value: "cards", label: "암기 카드" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** 4.1 학습: 오답노트, 암기 카드 탭 */
export function LearnView() {
  const [tab, setTab] = useStoredTab<Tab>("telos:learn-tab", ["notes", "cards"], "notes");
  return (
    <>
      <PageHeader title="학습" />
      <Tabs label="학습" tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      <CardErrorBoundary>{tab === "notes" ? <NotesScreen /> : <DecksScreen />}</CardErrorBoundary>
    </>
  );
}
