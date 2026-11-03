"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { DdayDialog } from "@/components/dday/dday-dialog";
import { DdayList, ddayPatch, useCreateDday } from "@/components/dday/dday-editor";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, useStoredTab } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { useDdayMutations, useDdays } from "@/lib/data/ddays";
import { useToday } from "@/lib/data/today";
import { ddayLabel } from "@/lib/dday/dday";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { DdayRow } from "@/lib/supabase/database.types";
import { ExamRoadmap } from "./exam-roadmap";
import { heroExam } from "./exam-hero";
import { PerfTab } from "./perf-tab";

const TABS = [
  { value: "roadmap", label: "시험 대비" },
  { value: "schedule", label: "일정" },
  { value: "perf", label: "수행평가" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const SELECTED_KEY = "telos:exam-selected";

/**
 * 6장 시험 화면.
 * 시험 대비: 시험마다 카테고리(로드맵·범위·회독·진행표)를 만들어 여러 개를 함께 진행한다.
 */
export function ExamView() {
  return (
    <Suspense fallback={null}>
      <ExamViewInner />
    </Suspense>
  );
}

function readSelected(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function ExamViewInner() {
  const today = useToday();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { data } = useDdays();
  const { update, trash } = useDdayMutations();
  const createDday = useCreateDday();
  const [tab, setTab] = useStoredTab<Tab>("telos:exam-tab", ["roadmap", "schedule", "perf"], "roadmap");
  const [examId, setExamIdState] = useState<string | null>(readSelected);
  const [showPast, setShowPast] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingEtc, setEditingEtc] = useState<DdayRow | null>(null);
  const [perfOpen, setPerfOpen] = useState<string | null>(null);

  const setExamId = (v: string) => {
    setExamIdState(v);
    try {
      window.localStorage.setItem(SELECTED_KEY, v);
    } catch {
      // 무시
    }
  };

  const ddays = useMemo(() => data ?? [], [data]);
  const exams = useMemo(() => ddays.filter((d) => d.type === "exam"), [ddays]);
  const upcoming = exams.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = exams.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const selected = exams.find((e) => e.id === examId) ?? heroExam(ddays, today) ?? upcoming[0] ?? past[0] ?? null;

  // 홈 D-day 카드에서 ?id= 로 들어오면 해당 상세로 (5.3)
  useEffect(() => {
    if (!id || ddays.length === 0) return;
    const d = ddays.find((x) => x.id === id);
    if (!d) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 주소의 id 를 한 번 화면 상태로 옮긴다 */
    if (d.type === "exam") {
      setExamId(d.id);
      setTab("roadmap");
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
      setTab("roadmap");
    } else if (d.type === "performance") {
      setTab("perf");
      setPerfOpen(d.id);
    } else setEditingEtc(d);
  };

  const chip = (e: DdayRow) => (
    <button
      key={e.id}
      type="button"
      aria-pressed={selected?.id === e.id}
      onClick={() => setExamId(e.id)}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-13",
        selected?.id === e.id ? "border-chip-on-line bg-chip-on text-ink" : "border-line text-ink-2",
      )}
    >
      {e.title}
      <span className="num text-11 text-sub">{e.date < today ? "끝남" : ddayLabel(e.date, today)}</span>
    </button>
  );

  return (
    <>
      <PageHeader title="스케줄" />
      <Tabs label="시험" tabs={TABS} value={tab} onChange={setTab} className="mb-4" />
      <CardErrorBoundary>
        {tab === "roadmap" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="시험 카테고리">
              {upcoming.map(chip)}
              {showPast ? past.map(chip) : null}
              {past.length > 0 ? (
                <button type="button" className="text-12 text-sub" onClick={() => setShowPast((v) => !v)}>
                  {showPast ? "지난 시험 숨기기" : `지난 시험 ${past.length}개`}
                </button>
              ) : null}
              <Button variant="dashed" pill onClick={() => setAdding(true)}>
                <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
                시험 추가
              </Button>
            </div>
            {selected ? (
              <ExamRoadmap key={selected.id} exam={selected} today={today} />
            ) : (
              <div className="card">
                <EmptyState message="시험을 추가하면 시험별 로드맵을 만들 수 있어요 (예: 2학기 기말고사, 11월 모의고사)" />
              </div>
            )}
          </div>
        ) : tab === "schedule" ? (
          <div className="card">
            <DdayList onOpenDetail={openDetail} />
          </div>
        ) : (
          <PerfTab today={today} openId={perfOpen} onOpened={() => setPerfOpen(null)} />
        )}
      </CardErrorBoundary>
      <DdayDialog
        open={adding}
        defaultType="exam"
        onClose={() => setAdding(false)}
        onSubmit={(v) => {
          const newIdValue = createDday(v);
          if (v.type === "exam") setExamId(newIdValue);
        }}
      />
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
