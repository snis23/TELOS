"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { RoundDialog } from "@/components/learn/round-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { SubjectDot } from "@/components/ui/subject-dot";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useMockRounds } from "@/lib/data/learn";
import { useAllRows } from "@/lib/data/queries";
import { useSubjects } from "@/lib/data/subjects";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { changeDirection, mockAxis, roundShortLabel } from "@/lib/grades/grades";
import type { MockRoundRow, MockScoreRow, SubjectRow } from "@/lib/supabase/database.types";
import { useLayout } from "@/lib/use-layout";
import { GradeLineChart } from "./line-chart";

type Metric = "raw" | "percentile" | "grade";
const METRIC_LABELS: Record<Metric, string> = { raw: "원점수", percentile: "백분위", grade: "등급" };
const valueOf = (s: MockScoreRow | undefined, m: Metric) => (s ? (m === "raw" ? s.raw_score : m === "percentile" ? s.percentile : s.grade) : null);

/** 8.3 모의고사 성적 */
export function MockScores() {
  const layout = useLayout();
  const { data: roundsData } = useMockRounds();
  const { data: scoresData } = useAllRows("mock_scores", { orderBy: "created_at" });
  const { data: subjectsData } = useSubjects();
  const roundMut = useTableMutations("mock_rounds", { unique: "같은 회차가 이미 있어요" });
  const [entering, setEntering] = useState<MockRoundRow | null>(null);
  const [roundDialog, setRoundDialog] = useState<MockRoundRow | "new" | null>(null);
  const [metric, setMetric] = useState<Metric>("raw");
  const [chosen, setChosen] = useState<string[]>([]);

  const rounds = useMemo(() => [...(roundsData ?? [])].sort((a, b) => a.year - b.year || a.month - b.month), [roundsData]);
  const scores = scoresData ?? [];
  const mockSubjects = (subjectsData ?? []).filter((s) => s.mock_max_score);
  const picked = chosen.length ? mockSubjects.filter((s) => chosen.includes(s.id)) : mockSubjects.slice(0, 1);
  const focus = picked[0];
  const twoColumns = layout === "land" || layout === "pc";

  const scoreOf = (roundId: string, subjectId: string) => scores.find((s) => s.mock_round_id === roundId && s.subject_id === subjectId);
  const noPercentile = metric === "percentile" ? picked.filter((s) => !s.has_percentile) : [];
  const chartSubjects = metric === "percentile" ? picked.filter((s) => s.has_percentile) : picked;
  const data = rounds.map((r) => {
    const row: Record<string, string | number | null> = { x: roundShortLabel(r.year, r.month) };
    for (const s of chartSubjects) row[s.id] = valueOf(scoreOf(r.id, s.id), metric);
    return row;
  });
  const values = chartSubjects.flatMap((s) => rounds.map((r) => valueOf(scoreOf(r.id, s.id), metric))).filter((v): v is number => v !== null);
  const maxScore = Math.max(...chartSubjects.map((s) => s.mock_max_score ?? 100), 50);
  const axis = mockAxis(metric, maxScore, values);

  const chart = (
    <Card title="모의고사 그래프">
      <div className="mb-3 flex flex-col gap-3">
        <div role="group" aria-label="과목 고르기" className="flex flex-wrap gap-2">
          {mockSubjects.map((s) => {
            const on = picked.some((p) => p.id === s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => setChosen(on ? picked.filter((p) => p.id !== s.id).map((p) => p.id) : [...picked.map((p) => p.id), s.id])}
                className={cn(
                  "inline-flex h-chip-phone items-center gap-2 rounded-full px-3 text-13",
                  on ? "bg-chip-on text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-surface-2 text-ink-2",
                )}
              >
                <SubjectDot color={s.color_key} />
                {s.name}
              </button>
            );
          })}
        </div>
        <Segmented label="지표" value={metric} onChange={setMetric} options={(Object.keys(METRIC_LABELS) as Metric[]).map((m) => ({ value: m, label: METRIC_LABELS[m] }))} />
        {noPercentile.length ? (
          <p role="status" className="text-12 text-sub" data-testid="no-percentile">
            {noPercentile.map((s) => s.name).join(", ")}: 절대평가라 백분위가 없어요
          </p>
        ) : null}
      </div>
      {rounds.length && chartSubjects.length ? (
        <GradeLineChart
          label={`모의고사 ${METRIC_LABELS[metric]}`}
          data={data}
          series={chartSubjects.map((s) => ({ key: s.id, name: s.name, color: s.color_key }))}
          domain={axis.domain}
          reversed={axis.reversed}
        />
      ) : (
        <p className="text-13 text-sub">그릴 기록이 없어요</p>
      )}
    </Card>
  );

  const summary = focus ? <Summary subject={focus} metric={metric} rounds={rounds} scoreOf={scoreOf} /> : null;
  const table = focus ? <RecordTable subject={focus} rounds={rounds} scoreOf={scoreOf} /> : null;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="회차"
        actions={
          <Button variant="secondary" onClick={() => setRoundDialog("new")}>
            <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
            회차 추가
          </Button>
        }
      >
        {rounds.length === 0 ? (
          <EmptyState message="아직 모의고사 회차가 없어요" />
        ) : (
          <ul className="flex flex-col">
            {[...rounds].reverse().map((r) => {
              const filled = scores.filter((s) => s.mock_round_id === r.id).length;
              return (
                <li key={r.id} className="flex min-h-11 items-center gap-2 border-b border-line last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-13 text-ink-2">{r.name}</span>
                  <span className="num text-11 text-sub">{filled}과목</span>
                  <Button variant="secondary" onClick={() => setEntering(r)}>
                    점수 입력
                  </Button>
                  <IconButton aria-label={`${r.name} 수정`} onClick={() => setRoundDialog(r)}>
                    <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {entering ? <ScoreTable key={entering.id} round={entering} subjects={mockSubjects} scores={scores} onDone={() => setEntering(null)} /> : null}

      {rounds.length ? (
        twoColumns ? (
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-8">
            {chart}
            <div className="card-stack">
              {summary}
              {table}
            </div>
          </div>
        ) : (
          <>
            {chart}
            {summary}
            {table}
          </>
        )
      ) : null}

      {roundDialog ? (
        <RoundDialog
          round={roundDialog === "new" ? null : roundDialog}
          onClose={() => setRoundDialog(null)}
          onSubmit={(v) => (roundDialog === "new" ? roundMut.insert.mutate({ rows: [{ id: newId(), ...v }] }) : roundMut.update.mutate({ ids: [roundDialog.id], patch: v }))}
          onDelete={
            roundDialog !== "new"
              ? () => {
                  roundMut.trash.mutate({ id: roundDialog.id });
                  setRoundDialog(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

/** 요약: 최근 값, 지난번 대비(오르면 --ok-ink, 내리면 긴급), 최고 값 */
function Summary({
  subject,
  metric,
  rounds,
  scoreOf,
}: {
  subject: SubjectRow;
  metric: Metric;
  rounds: MockRoundRow[];
  scoreOf: (r: string, s: string) => MockScoreRow | undefined;
}) {
  const vals = rounds.map((r) => valueOf(scoreOf(r.id, subject.id), metric)).filter((v): v is number => v !== null);
  const last = vals.at(-1) ?? null;
  const prev = vals.length > 1 ? vals[vals.length - 2] : null;
  const best = vals.length ? (metric === "grade" ? Math.min(...vals) : Math.max(...vals)) : null;
  const dir = changeDirection(prev, last, metric);
  const diff = last !== null && prev !== null ? Math.abs(last - prev) : null;
  if (metric === "percentile" && !subject.has_percentile) return null;
  return (
    <Card title={`${subject.name} 요약 · ${METRIC_LABELS[metric]}`}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-12 text-sub">최근</p>
          <p className="num text-22 font-medium">{last ?? "–"}</p>
        </div>
        <div>
          <p className="text-12 text-sub">지난번 대비</p>
          <p className={cn("num text-22 font-medium", dir === "up" && "text-ok-ink", dir === "down" && "text-urgent-ink")}>
            {dir === null ? "–" : dir === "same" ? "0" : `${dir === "up" ? "▲" : "▼"} ${Number(diff?.toFixed(1))}`}
          </p>
        </div>
        <div>
          <p className="text-12 text-sub">최고</p>
          <p className="num text-22 font-medium">{best ?? "–"}</p>
        </div>
      </div>
    </Card>
  );
}

/** 회차별 기록표: 최신 회차부터 (그래프의 표 보기 역할도 한다) */
function RecordTable({ subject, rounds, scoreOf }: { subject: SubjectRow; rounds: MockRoundRow[]; scoreOf: (r: string, s: string) => MockScoreRow | undefined }) {
  return (
    <Card title={`${subject.name} 회차별 기록`}>
      <table className="w-full text-13">
        <thead>
          <tr className="text-12 text-sub">
            <th className="py-2 text-left font-normal">회차</th>
            <th className="py-2 text-right font-normal">원점수</th>
            <th className="py-2 text-right font-normal">백분위</th>
            <th className="py-2 text-right font-normal">등급</th>
          </tr>
        </thead>
        <tbody>
          {[...rounds].reverse().map((r) => {
            const s = scoreOf(r.id, subject.id);
            return (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2 text-ink-2">{roundShortLabel(r.year, r.month)}</td>
                <td className="num py-2 text-right">{s?.raw_score ?? "–"}</td>
                <td className="num py-2 text-right">{s?.percentile ?? "–"}</td>
                <td className="num py-2 text-right">{s?.grade ?? "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/** 회차 하나의 모든 과목을 표 한 장에서 입력. 백분위는 국어·수학·탐구만 */
function ScoreTable({ round, subjects, scores, onDone }: { round: MockRoundRow; subjects: SubjectRow[]; scores: MockScoreRow[]; onDone: () => void }) {
  const { insert, update } = useTableMutations("mock_scores");
  const existing = (id: string) => scores.find((s) => s.mock_round_id === round.id && s.subject_id === id);
  const [drafts, setDrafts] = useState<Record<string, { raw: string; pct: string; grade: string }>>(() =>
    Object.fromEntries(
      subjects.map((s) => {
        const e = existing(s.id);
        return [s.id, { raw: e?.raw_score != null ? String(e.raw_score) : "", pct: e?.percentile != null ? String(e.percentile) : "", grade: e?.grade != null ? String(e.grade) : "" }];
      }),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const n = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = () => {
    const errs: Record<string, string> = {};
    const inserts: Partial<MockScoreRow>[] = [];
    for (const s of subjects) {
      const d = drafts[s.id];
      const raw = n(d.raw);
      const pct = s.has_percentile ? n(d.pct) : null;
      const grade = n(d.grade);
      const max = s.mock_max_score ?? 100;
      if (raw !== null && (raw < 0 || raw > max || Math.round(raw * 10) !== raw * 10)) errs[s.id] = `원점수는 0~${max}`;
      else if (pct !== null && (pct < 0 || pct > 100)) errs[s.id] = "백분위는 0~100";
      else if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 9)) errs[s.id] = "등급은 1~9";
      if (errs[s.id]) continue;
      const prev = existing(s.id);
      if (raw === null && pct === null && grade === null) continue;
      const patch = { raw_score: raw, percentile: pct, grade };
      if (prev) update.mutate({ ids: [prev.id], patch });
      else inserts.push({ id: newId(), mock_round_id: round.id, subject_id: s.id, ...patch });
    }
    if (inserts.length) insert.mutate({ rows: inserts });
    setErrors(errs);
    if (Object.keys(errs).length === 0) onDone();
  };

  const input = "control-h w-full min-w-0 rounded-input bg-surface-2 px-2 text-13 text-ink num outline-none focus-visible:outline-2 focus-visible:outline-check";
  return (
    <Card
      title={`${round.name} 점수 입력`}
      actions={
        <>
          <Button variant="secondary" onClick={onDone}>
            닫기
          </Button>
          <Button onClick={save}>저장</Button>
        </>
      }
    >
      <table className="w-full text-13" data-testid="mock-table">
        <thead>
          <tr className="text-12 text-sub">
            <th className="py-2 text-left font-normal">과목</th>
            <th className="py-2 font-normal">원점수</th>
            <th className="py-2 font-normal">백분위</th>
            <th className="py-2 font-normal">등급</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => {
            const d = drafts[s.id];
            const set = (k: "raw" | "pct" | "grade", v: string) => setDrafts({ ...drafts, [s.id]: { ...d, [k]: v.replace(/[^0-9.]/g, "") } });
            return (
              <tr key={s.id} className="border-t border-line align-top">
                <td className="py-2">
                  <span className="flex items-center gap-2 pt-2.5">
                    <SubjectDot color={s.color_key} />
                    {s.name}
                    <span className="num text-11 text-sub">/{s.mock_max_score}</span>
                  </span>
                  {errors[s.id] ? <span className="text-11 text-urgent-ink">{errors[s.id]}</span> : null}
                </td>
                <td className="px-1 py-2">
                  <input aria-label={`${s.name} 원점수`} inputMode="decimal" value={d.raw} onChange={(e) => set("raw", e.target.value)} className={input} />
                </td>
                <td className="px-1 py-2">
                  {s.has_percentile ? (
                    <input aria-label={`${s.name} 백분위`} inputMode="decimal" value={d.pct} onChange={(e) => set("pct", e.target.value)} className={input} />
                  ) : (
                    <span className="block pt-2.5 text-center text-sub">–</span>
                  )}
                </td>
                <td className="px-1 py-2">
                  <input aria-label={`${s.name} 등급`} inputMode="numeric" value={d.grade} onChange={(e) => set("grade", e.target.value)} className={input} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
