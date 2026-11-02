"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { useTimerContext } from "@/components/timer/timer-provider";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { SelectField } from "@/components/ui/select";
import { SubjectDot } from "@/components/ui/subject-dot";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { useDayStartHour } from "@/lib/data/profile";
import { useAllRows } from "@/lib/data/queries";
import { useRecurrences, useTasks } from "@/lib/data/tasks";
import { useDailyStats, useDeferrals, useRecentRecurringTasks } from "@/lib/data/stats";
import { useSubjectMap, useSubjects } from "@/lib/data/subjects";
import { useDaySessions } from "@/lib/data/timer";
import { WEEKDAY_SHORT, eachDay, formatMonthDay, formatMonthDayWeekday, isoWeekday } from "@/lib/date/days";
import {
  deferralAnalysis,
  executionRate,
  grassDays,
  grassLevel,
  lastDays,
  periodRange,
  streak,
  sumTotals,
  todayPlanned,
  totalsFromStats,
  type DayTotal,
  type Period,
} from "@/lib/stats/summary";
import { formatDurationKo, formatHM } from "@/lib/timer/format";
import { napSummary, studySecondsBySubject } from "@/lib/timer/sessions";

const GRASS = ["bg-surface-2", "bg-grass-1", "bg-grass-2", "bg-grass-3", "bg-grass-4"] as const;
const GRASS_LABEL = ["기록 없음", "1시간 미만", "3시간 미만", "5시간 미만", "5시간 이상"];

/** 8.1 기록 화면: 통계, 미루기 분석, 회고 모아보기 */
export function RecordView() {
  const { today, now } = useTimerContext();
  const dayStartHour = useDayStartHour();
  const { data: stats } = useDailyStats(today);
  const { data: sessions } = useDaySessions(today);
  const { data: tasks } = useTasks(today);
  const { data: deferrals } = useDeferrals(today);
  const subjects = useSubjectMap();
  const { data: subjectList } = useSubjects();

  // 지난 날짜는 daily_stats, 오늘은 진행 중인 기록을 합쳐서 계산 (9.1)
  const totals = useMemo(() => {
    const map = totalsFromStats((stats ?? []).filter((r) => r.study_date < today));
    const live = studySecondsBySubject(sessions ?? [], today, dayStartHour, now);
    const nap = napSummary(sessions ?? [], today, dayStartHour, now);
    const plan = todayPlanned(tasks ?? [], (deferrals ?? []).filter((d) => d.from_date === today));
    map.set(today, {
      date: today,
      study: live.total,
      bySubject: live.bySubject,
      nap: nap.seconds,
      napCount: nap.count,
      planned: plan.planned,
      done: plan.done,
    });
    return map;
  }, [stats, sessions, tasks, deferrals, today, dayStartHour, now]);

  return (
    <>
      <PageHeader title="기록" />
      <div className="card-stack">
        <StatsCard totals={totals} today={today} subjects={subjects} subjectOrder={(subjectList ?? []).map((s) => s.id)} />
        <div className="grid gap-6 pad:gap-8 land:grid-cols-2">
          <WeekBars totals={totals} today={today} />
          <StreakCard totals={totals} today={today} />
        </div>
        <GrassCard totals={totals} today={today} />
        <DeferCard today={today} />
        <ReflectionArchive />
      </div>
    </>
  );
}

function StatsCard({
  totals,
  today,
  subjects,
  subjectOrder,
}: {
  totals: Map<string, DayTotal>;
  today: string;
  subjects: ReturnType<typeof useSubjectMap>;
  subjectOrder: string[];
}) {
  const [period, setPeriod] = useState<Period>("day");
  const range = periodRange(period, today);
  const days = eachDay(range.from, range.to)
    .map((d) => totals.get(d))
    .filter((d): d is DayTotal => Boolean(d));
  const sum = sumTotals(days);
  const rate = executionRate(sum.planned, sum.done);
  const shares = [...sum.bySubject.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const ia = subjectOrder.indexOf(a[0]);
      const ib = subjectOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  const tile = (label: string, value: string, sub?: string) => (
    <div className="rounded-item bg-surface-2 p-4">
      <p className="text-12 text-ink-2">{label}</p>
      <p className="num mt-1 text-22 font-medium">{value}</p>
      {sub ? <p className="text-11 text-ink-2">{sub}</p> : null}
    </div>
  );
  return (
    <Card
      title="통계"
      actions={
        <Segmented
          label="기간"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "day", label: "일" },
            { value: "week", label: "주" },
            { value: "month", label: "월" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-5" data-testid="stats-card">
        <div className="grid grid-cols-2 gap-3 pad:grid-cols-3">
          {tile("순공 합계", formatHM(sum.study))}
          {tile("쪽잠", formatDurationKo(sum.nap), `${sum.napCount}회`)}
          {tile("실행률", rate === null ? "–" : `${Math.round(rate * 100)}%`, `${sum.done}/${sum.planned}`)}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-12 text-sub">과목별 순공 비중</h3>
          {shares.length === 0 ? (
            <p className="text-13 text-sub">이 기간의 공부 기록이 없어요</p>
          ) : (
            shares.map(([id, sec]) => {
              const s = subjects.get(id);
              const pct = sum.study ? sec / sum.study : 0;
              return (
                <div key={id} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3" data-subject={s?.color_key}>
                  <span className="flex min-w-0 items-center gap-2 text-13 text-ink-2">
                    {s ? <SubjectDot color={s.color_key} /> : null}
                    <span className="truncate">{s?.name ?? "삭제한 과목"}</span>
                  </span>
                  <ProgressBar value={pct} label={`${s?.name ?? ""} 비중`} tone="subject" />
                  <span className="num text-12 text-ink-2">
                    {formatHM(sec)} · {Math.round(pct * 100)}%
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}

/** 최근 7일 그래프: 하루 순공 세로 막대. 지난 날 --line-2, 오늘 --check. 막대 위에 시간 */
function WeekBars({ totals, today }: { totals: Map<string, DayTotal>; today: string }) {
  const days = lastDays(today, 7);
  const values = days.map((d) => totals.get(d)?.study ?? 0);
  const max = Math.max(3600, ...values);
  return (
    <Card title="최근 7일">
      <div className="flex h-40 items-end gap-2" role="img" aria-label={`최근 7일 순공: ${days.map((d, i) => `${formatMonthDay(d)} ${formatHM(values[i])}`).join(", ")}`}>
        {days.map((d, i) => (
          <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${formatMonthDayWeekday(d)} ${formatHM(values[i])}`}>
            <span className="num text-11 text-ink-2">{formatHM(values[i])}</span>
            <div
              className={cn("w-full max-w-8 rounded-t-key", d === today ? "bg-check" : "bg-line-2")}
              style={{ height: `${Math.max(2, (values[i] / max) * 100)}%` }}
            />
            <span className={cn("text-11", d === today ? "font-semibold text-ink" : "text-sub")}>{WEEKDAY_SHORT[isoWeekday(d) - 1]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StreakCard({ totals, today }: { totals: Map<string, DayTotal>; today: string }) {
  const byDate = new Map([...totals.entries()].map(([d, t]) => [d, t.study]));
  const n = streak(byDate, today);
  return (
    <Card title="연속 달성일">
      <p className="num text-36 leading-none font-semibold tracking-num">
        {n}
        <span className="ml-1 text-14 font-normal text-sub">일</span>
      </p>
      <p className="mt-2 text-12 text-sub">순공 30분 이상인 날이 오늘(또는 어제)까지 이어진 날이에요</p>
    </Card>
  );
}

/** 공부 잔디: 최근 16주, 7행, 칸 12px, 간격 3px */
function GrassCard({ totals, today }: { totals: Map<string, DayTotal>; today: string }) {
  const weeks = grassDays(today);
  return (
    <Card title="공부 잔디">
      <div className="overflow-x-auto">
        <div className="flex gap-bar" role="img" aria-label="최근 16주 공부 잔디">
          {weeks.map((week) => (
            <div key={week[0]} className="flex flex-col gap-bar">
              {week.map((d) => {
                const sec = totals.get(d)?.study ?? 0;
                const level = d > today ? -1 : grassLevel(sec);
                return (
                  <span
                    key={d}
                    title={`${formatMonthDayWeekday(d)} ${formatHM(sec)}`}
                    className={cn("size-3 rounded-key", level === -1 ? "bg-transparent" : GRASS[level])}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-11 text-sub">
        {GRASS.map((cls, i) => (
          <span key={cls} className="flex items-center gap-1">
            <span className={cn("size-3 rounded-key", cls)} />
            {GRASS_LABEL[i]}
          </span>
        ))}
      </div>
    </Card>
  );
}

function DeferCard({ today }: { today: string }) {
  const { data: deferrals } = useDeferrals(today);
  const { data: recTasks } = useRecentRecurringTasks(today);
  const { data: recurrences } = useRecurrences();
  const subjects = useSubjectMap();
  const a = deferralAnalysis(deferrals ?? [], recTasks ?? [], today);
  const maxSubject = Math.max(1, ...a.bySubject.values());
  const recMap = new Map((recurrences ?? []).map((r) => [r.id, r.title]));
  return (
    <Card title="미루기 분석 (최근 30일)">
      <div className="grid gap-6 land:grid-cols-3">
        <div>
          <p className="text-12 text-sub">미룬 횟수 합계</p>
          <p className="num text-22 font-medium" data-testid="defer-total">
            {a.total}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {[...a.bySubject.entries()].map(([id, n]) => {
              const s = id ? subjects.get(id) : undefined;
              return (
                <div key={id ?? "none"} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-2" data-subject={s?.color_key}>
                  <span className="truncate text-12 text-ink-2">{s?.name ?? "과목 없음"}</span>
                  <ProgressBar value={n / maxSubject} label={`${s?.name ?? "과목 없음"} 미룬 횟수`} tone={s ? "subject" : "normal"} />
                  <span className="num text-right text-12 text-ink-2">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-12 text-sub">자주 미룬 할 일</p>
          {a.top.length === 0 ? (
            <p className="text-13 text-sub">미룬 할 일이 없어요</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {a.top.map(([title, n]) => (
                <li key={title} className="flex justify-between gap-2 text-13 text-ink-2">
                  <span className="truncate">{title}</span>
                  <span className="num text-12 text-sub">{n}번</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <p className="mb-2 text-12 text-sub">반복 할 일별 못 한 비율</p>
          {a.recurrenceMissed.size === 0 ? (
            <p className="text-13 text-sub">반복 할 일 기록이 없어요</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {[...a.recurrenceMissed.entries()].map(([id, r]) => (
                <li key={id} className="flex justify-between gap-2 text-13 text-ink-2">
                  <span className="truncate">{recMap.get(id) ?? "지운 반복"}</span>
                  <span className="num text-12 text-sub">
                    {Math.round((r.missed / r.total) * 100)}% ({r.missed}/{r.total})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

/** 회고 모아보기: 최신 날짜부터. 날짜, 컨디션, 세 줄. 월 거르기와 글자 검색 */
function ReflectionArchive() {
  const { data } = useAllRows("reflections", { orderBy: "study_date" });
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const list = [...(data ?? [])].reverse();
  const months = [...new Set(list.map((r) => r.study_date.slice(0, 7)))];
  const shown = list.filter(
    (r) => (!month || r.study_date.startsWith(month)) && (!q.trim() || `${r.good} ${r.bad} ${r.tomorrow}`.includes(q.trim())),
  );
  return (
    <Card title="회고 모아보기">
      <div className="mb-4 grid grid-cols-2 gap-3 pad:max-w-portrait">
        <SelectField label="월" value={month} onChange={setMonth} options={[{ value: "", label: "전체" }, ...months.map((m) => ({ value: m, label: `${m.slice(0, 4)}년 ${Number(m.slice(5))}월` }))]} />
        <TextField label="검색" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.length === 0 ? (
        <EmptyState message="아직 쓴 회고가 없어요" />
      ) : (
        <ul className="flex flex-col">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0">
              <p className="flex items-center gap-2 text-12 text-sub">
                {formatMonthDayWeekday(r.study_date)}
                {r.condition ? <span className="num rounded-full bg-nav-on px-2 text-11 text-accent-strong">컨디션 {r.condition}</span> : null}
              </p>
              {r.good ? <p className="text-13 text-ink-2">잘한 것 · {r.good}</p> : null}
              {r.bad ? <p className="text-13 text-ink-2">아쉬운 것 · {r.bad}</p> : null}
              {r.tomorrow ? <p className="text-13 text-ink-2">내일 할 것 · {r.tomorrow}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

