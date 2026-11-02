"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { studyDayWindow } from "@/lib/stats/daily";
import { requireSupabase } from "@/lib/supabase/client";
import type { SessionKind, TimerSessionRow } from "@/lib/supabase/database.types";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { formatDurationKo } from "@/lib/timer/format";
import { guessDeviceLabel, napSummary, sessionSeconds, studySecondsBySubject } from "@/lib/timer/sessions";
import { newId } from "./crud";
import { useDayStartHour } from "./profile";
import { useSaveErrorToast } from "./save-error";
import { useSubjectMap } from "./subjects";

/**
 * 5.4 과목별 타이머, 5.5 쪽잠.
 * 기록은 시작·종료 시각으로 저장하고, 화면은 "지금 − 시작"으로 계산한다.
 * 켜진 기록은 사용자당 하나 (DB 부분 고유 인덱스). 누른 순간의 시각을 기억해 보낸다 (오프라인 대비).
 */

export const activeKey = ["timer_sessions", "active"] as const;
export const daySessionsKey = (date: string) => ["timer_sessions", "day", date] as const;

const MINE_KEY = "telos:my-sessions";
const LAST_SUBJECT_KEY = "telos:last-subject";

function readMine(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(MINE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function rememberMine(id: string) {
  try {
    window.localStorage.setItem(MINE_KEY, JSON.stringify([id, ...readMine()].slice(0, 50)));
  } catch {
    // 무시
  }
}
/** 이 기기에서 시작한 기록인지 */
export function isMine(session: Pick<TimerSessionRow, "id">): boolean {
  return readMine().includes(session.id);
}

export function readLastSubject(): string | null {
  try {
    return window.localStorage.getItem(LAST_SUBJECT_KEY);
  } catch {
    return null;
  }
}
function writeLastSubject(id: string | null) {
  try {
    if (id) window.localStorage.setItem(LAST_SUBJECT_KEY, id);
  } catch {
    // 무시
  }
}

export function useActiveSession() {
  return useQuery({
    queryKey: activeKey,
    queryFn: async (): Promise<TimerSessionRow | null> => {
      const { data, error } = await requireSupabase()
        .from("timer_sessions")
        .select("*")
        .is("ended_at", null)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** 그날과 겹치는 기록 (앞날 시작해 넘어온 기록 포함) */
export function useDaySessions(date: string) {
  const dayStartHour = useDayStartHour();
  return useQuery({
    queryKey: daySessionsKey(date),
    queryFn: async (): Promise<TimerSessionRow[]> => {
      const w = studyDayWindow(date, dayStartHour);
      const from = new Date(w.start.getTime() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await requireSupabase()
        .from("timer_sessions")
        .select("*")
        .is("deleted_at", null)
        .gte("started_at", from)
        .lt("started_at", w.end.toISOString())
        .order("started_at", { ascending: true });
      if (error) throw error;
      return data.filter((s) => !s.ended_at || new Date(s.ended_at) > w.start);
    },
  });
}

/** 다른 기기에서 켠 타이머와 부딪쳤을 때 */
export class TimerConflict extends Error {
  constructor(public readonly active: TimerSessionRow) {
    super("timer conflict");
  }
}

type StartVars = { id: string; kind: SessionKind; subjectId: string | null; at: string; endActiveId?: string | null };

async function fetchActive(): Promise<TimerSessionRow | null> {
  const { data } = await requireSupabase()
    .from("timer_sessions")
    .select("*")
    .is("ended_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

export type Conflict = { active: TimerSessionRow; next: Omit<StartVars, "id" | "at" | "endActiveId"> };

export function useTimer(studyDate: string, now: Date) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const onSaveError = useSaveErrorToast();
  const dayStartHour = useDayStartHour();
  const subjects = useSubjectMap();
  const active = useActiveSession();
  const day = useDaySessions(studyDate);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [selected, setSelected] = useState<string | null>(() => readLastSubject());

  const activeSession = active.data ?? null;
  const sessions = useMemo(() => day.data ?? [], [day.data]);

  const settle = () => queryClient.invalidateQueries({ queryKey: ["timer_sessions"] });

  const patchCaches = (fn: (rows: TimerSessionRow[]) => TimerSessionRow[], nextActive: TimerSessionRow | null | undefined) => {
    if (nextActive !== undefined) queryClient.setQueryData(activeKey, nextActive);
    queryClient.setQueryData<TimerSessionRow[]>(daySessionsKey(studyDate), (old) => (old ? fn(old) : old));
  };

  const start = useMutation({
    mutationFn: async (vars: StartVars) => {
      const supabase = requireSupabase();
      if (vars.endActiveId) {
        const { error } = await supabase
          .from("timer_sessions")
          .update({ ended_at: vars.at })
          .eq("id", vars.endActiveId)
          .is("ended_at", null);
        if (error) throw error;
      }
      const { error } = await supabase.from("timer_sessions").insert({
        id: vars.id,
        kind: vars.kind,
        subject_id: vars.subjectId,
        started_at: vars.at,
        device_label: guessDeviceLabel(),
      });
      if (error) {
        if (isUniqueViolation(error)) {
          const current = await fetchActive();
          if (current) throw new TimerConflict(current);
        }
        throw error;
      }
      rememberMine(vars.id);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["timer_sessions"] });
      const prevActive = queryClient.getQueryData(activeKey);
      const prevDay = queryClient.getQueryData(daySessionsKey(studyDate));
      const row: TimerSessionRow = {
        id: vars.id,
        user_id: "",
        kind: vars.kind,
        subject_id: vars.subjectId,
        started_at: vars.at,
        ended_at: null,
        device_label: guessDeviceLabel(),
        deleted_at: null,
        delete_batch_id: null,
        created_at: vars.at,
        updated_at: vars.at,
      };
      patchCaches(
        (rows) => [...rows.map((r) => (r.id === vars.endActiveId ? { ...r, ended_at: vars.at } : r)), row],
        row,
      );
      return { prevActive, prevDay };
    },
    onError: (error, vars, ctx) => {
      queryClient.setQueryData(activeKey, ctx?.prevActive);
      queryClient.setQueryData(daySessionsKey(studyDate), ctx?.prevDay);
      if (error instanceof TimerConflict) {
        setConflict({ active: error.active, next: { kind: vars.kind, subjectId: vars.subjectId } });
        return;
      }
      onSaveError(error, () => {
        start.mutate(vars);
      });
    },
    onSettled: settle,
  });

  const end = useMutation({
    mutationFn: async (vars: { id: string; at: string }) => {
      const { error } = await requireSupabase().from("timer_sessions").update({ ended_at: vars.at }).eq("id", vars.id);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["timer_sessions"] });
      const prevActive = queryClient.getQueryData(activeKey);
      const prevDay = queryClient.getQueryData(daySessionsKey(studyDate));
      patchCaches((rows) => rows.map((r) => (r.id === vars.id ? { ...r, ended_at: vars.at } : r)), null);
      return { prevActive, prevDay };
    },
    onError: (error, vars, ctx) => {
      queryClient.setQueryData(activeKey, ctx?.prevActive);
      queryClient.setQueryData(daySessionsKey(studyDate), ctx?.prevDay);
      onSaveError(error, () => {
        end.mutate(vars);
      });
    },
    onSettled: settle,
  });

  const studying = activeSession?.kind === "study" ? activeSession : null;
  const napping = activeSession?.kind === "nap" ? activeSession : null;
  const selectedSubject = studying?.subject_id ?? selected ?? null;

  const begin = useCallback(
    (kind: SessionKind, subjectId: string | null) => {
      const at = new Date().toISOString();
      if (activeSession && !isMine(activeSession)) {
        setConflict({ active: activeSession, next: { kind, subjectId } });
        return;
      }
      start.mutate({ id: newId(), kind, subjectId, at, endActiveId: activeSession?.id ?? null });
    },
    [activeSession, start],
  );

  /** 재생/일시정지 (Space) */
  const toggle = useCallback(() => {
    if (studying) {
      end.mutate({ id: studying.id, at: new Date().toISOString() });
      return;
    }
    const subjectId = selectedSubject ?? [...subjects.values()][0]?.id ?? null;
    if (!subjectId) return;
    setSelected(subjectId);
    writeLastSubject(subjectId);
    begin("study", subjectId);
  }, [studying, selectedSubject, subjects, begin, end]);

  /** 과목 전환: 측정 중이면 지금 기록을 끝내고 바로 새로 시작, 멈춘 상태면 선택만 */
  const selectSubject = useCallback(
    (subjectId: string) => {
      setSelected(subjectId);
      writeLastSubject(subjectId);
      if (studying && studying.subject_id !== subjectId) begin("study", subjectId);
    },
    [studying, begin],
  );

  /** 이 과목으로 바로 측정 시작 (오늘 화면의 지금 할 일). 이미 그 과목을 재는 중이면 그대로 */
  const startSubject = useCallback(
    (subjectId: string) => {
      setSelected(subjectId);
      writeLastSubject(subjectId);
      if (studying?.subject_id !== subjectId) begin("study", subjectId);
    },
    [studying, begin],
  );

  /** 쪽잠 시작: 공부 기록을 끝내고(과목은 기억) 쪽잠을 시작 */
  const startNap = useCallback(() => {
    if (studying?.subject_id) writeLastSubject(studying.subject_id);
    begin("nap", null);
  }, [studying, begin]);

  /** 쪽잠 끝: "쪽잠 15분 기록했어요 [수학 이어서 하기]" */
  const endNap = useCallback(() => {
    if (!napping) return;
    const at = new Date().toISOString();
    end.mutate({ id: napping.id, at });
    const seconds = sessionSeconds({ started_at: napping.started_at, ended_at: at }, new Date(at));
    const lastSubject = readLastSubject();
    const subject = lastSubject ? subjects.get(lastSubject) : undefined;
    toast.show({
      message: `쪽잠 ${formatDurationKo(seconds)} 기록했어요`,
      action: subject
        ? {
            label: `${subject.name} 이어서 하기`,
            onClick: () => {
              setSelected(subject.id);
              start.mutate({ id: newId(), kind: "study", subjectId: subject.id, at: new Date().toISOString() });
            },
          }
        : undefined,
    });
  }, [napping, end, subjects, toast, start]);

  const toggleNap = useCallback(() => (napping ? endNap() : startNap()), [napping, endNap, startNap]);

  /** 다른 기기 기록을 끝내고 여기서 새로 시작 */
  const resolveConflict = useCallback(() => {
    if (!conflict) return;
    start.mutate({
      id: newId(),
      kind: conflict.next.kind,
      subjectId: conflict.next.subjectId,
      at: new Date().toISOString(),
      endActiveId: conflict.active.id,
    });
    setConflict(null);
  }, [conflict, start]);

  const endAt = useCallback((id: string, at: Date) => end.mutate({ id, at: at.toISOString() }), [end]);

  const totals = useMemo(
    () => studySecondsBySubject(sessions, studyDate, dayStartHour, now),
    [sessions, studyDate, dayStartHour, now],
  );
  const nap = useMemo(() => napSummary(sessions, studyDate, dayStartHour, now), [sessions, studyDate, dayStartHour, now]);

  return {
    ready: !active.isPending && !day.isPending,
    active: activeSession,
    studying,
    napping,
    sessions,
    selectedSubject,
    totals,
    nap,
    toggle,
    selectSubject,
    startSubject,
    toggleNap,
    startNap,
    endNap,
    endAt,
    conflict,
    resolveConflict,
    dismissConflict: () => setConflict(null),
  };
}

export type TimerApi = ReturnType<typeof useTimer>;
