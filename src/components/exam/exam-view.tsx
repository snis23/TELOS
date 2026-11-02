"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DdayDialog } from "@/components/dday/dday-dialog";
import { DdayList, ddayPatch } from "@/components/dday/dday-editor";
import { PageHeader } from "@/components/shell/page-header";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, useStoredTab } from "@/components/ui/tabs";
import { useDdayMutations, useDdays, useExamProgressMap } from "@/lib/data/ddays";
import { useToday } from "@/lib/data/today";
import { isUpcoming } from "@/lib/dday/dday";
import type { DdayRow } from "@/lib/supabase/database.types";
import { ExamHero, heroExam } from "./exam-hero";
import { ExamPicker } from "./exam-picker";
import { PerfTab } from "./perf-tab";
import { RangeTab } from "./range-tab";
import { ReviewTab } from "./review-tab";

const TABS = [
  { value: "schedule", label: "일정" },
  { value: "range", label: "범위 분배" },
  { value: "review", label: "회독" },
  { value: "perf", label: "수행평가" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/** 6.5 시험 화면 */
export function ExamView() {
  return (
    <Suspense fallback={null}>
      <ExamViewInner />
    </Suspense>
  );
}

function ExamViewInner() {
  const today = useToday();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { data } = useDdays();
  const progress = useExamProgressMap();
  const { update, trash } = useDdayMutations();
  const [tab, setTab] = useStoredTab<Tab>("telos:exam-tab", ["schedule", "range", "review", "perf"], "schedule");
  const [examId, setExamId] = useState<string | null>(null);
  const [editingEtc, setEditingEtc] = useState<DdayRow | null>(null);
  const [perfOpen, setPerfOpen] = useState<string | null>(null);

  const ddays = useMemo(() => data ?? [], [data]);
  const hero = heroExam(ddays, today);
  const exams = ddays
    .filter((d) => d.type === "exam" && (isUpcoming(d, today) || d.id === examId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const selected = exams.find((e) => e.id === examId) ?? hero ?? exams[0] ?? null;

  // 홈 D-day 카드에서 ?id= 로 들어오면 해당 상세로 (5.3)
  useEffect(() => {
    if (!id || ddays.length === 0) return;
    const d = ddays.find((x) => x.id === id);
    if (!d) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 주소의 id 를 한 번 화면 상태로 옮긴다 */
    if (d.type === "exam") {
      setExamId(d.id);
      setTab("range");
    } else if (d.type === "performance") {
      setTab("perf");
      setPerfOpen(d.id);
    } else {
      setTab("schedule");
      setEditingEtc(d);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    router.replace("/exam/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ddays.length]);

  const openDetail = (d: DdayRow) => {
    if (d.type === "exam") {
      setExamId(d.id);
      setTab("range");
    } else if (d.type === "performance") {
      setTab("perf");
      setPerfOpen(d.id);
    } else setEditingEtc(d);
  };

  return (
    <>
      <PageHeader title="시험" />
      <div className="card-stack">
        <ExamHero exam={selected ?? hero} today={today} progress={progress.get((selected ?? hero)?.id ?? "") ?? null} />
        <div>
          <Tabs label="시험" tabs={TABS} value={tab} onChange={setTab} className="mb-4" />
          <CardErrorBoundary>
            {tab === "schedule" ? (
              <div className="card">
                <DdayList onOpenDetail={openDetail} />
              </div>
            ) : tab === "perf" ? (
              <PerfTab today={today} openId={perfOpen} onOpened={() => setPerfOpen(null)} />
            ) : (
              <div className="flex flex-col gap-4">
                {exams.length > 1 ? <ExamPicker exams={exams} value={selected?.id ?? null} onChange={setExamId} /> : null}
                {tab === "range" ? <RangeTab exam={selected} today={today} /> : <ReviewTab exam={selected} />}
              </div>
            )}
          </CardErrorBoundary>
        </div>
      </div>
      <DdayDialog
        open={editingEtc !== null}
        dday={editingEtc}
        onClose={() => setEditingEtc(null)}
        onSubmit={(v) => editingEtc && update.mutate({ ids: [editingEtc.id], patch: ddayPatch(v) })}
        onDelete={
          editingEtc
            ? () => {
                trash.mutate({ id: editingEtc.id });
                setEditingEtc(null);
              }
            : undefined
        }
      />
    </>
  );
}
