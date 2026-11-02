"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { addDays } from "@/lib/date/days";
import { missedStreak, recurrencesDue } from "@/lib/tasks/recurrence";
import { requireSupabase } from "@/lib/supabase/client";
import type { RecurrenceRow, TaskRow, TimetableSlotRow } from "@/lib/supabase/database.types";
import { slotsOf, timetableForDate } from "@/lib/timetable/resolve";
import { snap } from "@/lib/timetable/time";
import { useTableMutations } from "./crud";
import { useAllRows } from "./queries";
import { useSaveErrorToast } from "./save-error";

/** 5.6 오늘 할 일 */

export const tasksKey = (date: string) => ["tasks", "date", date] as const;
export const staleKey = (today: string) => ["tasks", "stale", today] as const;

export function useTasks(date: string) {
  return useQuery({
    queryKey: tasksKey(date),
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await requireSupabase()
        .from("tasks")
        .select("*")
        .eq("study_date", date)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** 여러 날짜의 할 일 (주간 계획, 통계) */
export function useTasksRange(from: string, to: string) {
  return useQuery({
    queryKey: ["tasks", "range", from, to],
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await requireSupabase()
        .from("tasks")
        .select("*")
        .gte("study_date", from)
        .lte("study_date", to)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** 지난 날짜에 안 끝낸 일반 할 일 (30일 안) */
export function useStaleTasks(today: string) {
  return useQuery({
    queryKey: staleKey(today),
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await requireSupabase()
        .from("tasks")
        .select("*")
        .lt("study_date", today)
        .gte("study_date", addDays(today, -30))
        .is("done_at", null)
        .is("deleted_at", null)
        .in("source", ["manual", "roadmap"]);
      if (error) throw error;
      return data;
    },
  });
}

export function useRecurrences() {
  return useAllRows("recurrences", { orderBy: "created_at" });
}

export function useTaskMutations() {
  return useTableMutations("tasks");
}

/** 미루기: 내일로 넘기기, 한 번에 넘기기, 오늘로 가져오기 (+ 되돌리기) */
export function useDefer() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const onSaveError = useSaveErrorToast();

  const undo = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await requireSupabase().rpc("undefer_tasks", { p_ids: ids });
      if (error) throw error;
    },
    onError: (error, ids) =>
      onSaveError(error, () => {
        undo.mutate(ids);
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const defer = useMutation({
    mutationFn: async (vars: { ids: string[]; to: string; message: (n: number) => string }) => {
      const { data, error } = await requireSupabase().rpc("defer_tasks", { p_ids: vars.ids, p_to: vars.to });
      if (error) throw error;
      return (data ?? []) as string[];
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const snap = queryClient.getQueriesData({ queryKey: ["tasks"] });
      const ids = new Set(vars.ids);
      // 원래 날짜 목록에서 바로 뺀다
      queryClient.setQueriesData<TaskRow[]>({ queryKey: ["tasks"] }, (old) =>
        Array.isArray(old) ? old.filter((t) => !ids.has(t.id) || t.study_date === vars.to) : old,
      );
      return { snap };
    },
    onSuccess: (moved, vars) => {
      if (moved.length === 0) return;
      toast.show({
        message: vars.message(moved.length),
        action: { label: "되돌리기", onClick: () => undo.mutate(moved) },
      });
    },
    onError: (error, vars, ctx) => {
      for (const [key, data] of ctx?.snap ?? []) queryClient.setQueryData(key, data);
      onSaveError(error, () => {
        defer.mutate(vars);
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return { defer, undo };
}

/**
 * 그날의 반복 할 일을 만든다 (5.6). 같은 반복·같은 날짜는 하나만 (DB 고유 제약 + 건너뛰기).
 * 연속으로 못 한 횟수와 기본 차시·시각도 이때 채운다.
 */
export async function ensureRecurrenceTasks(date: string, dayStartHour: number): Promise<number> {
  const supabase = requireSupabase();
  const [recs, existing, done, timetables, slots, holidays, dateTimetables] = await Promise.all([
    supabase.from("recurrences").select("*").is("deleted_at", null),
    supabase.from("tasks").select("recurrence_id").eq("study_date", date).not("recurrence_id", "is", null),
    supabase
      .from("tasks")
      .select("recurrence_id, study_date")
      .gte("study_date", addDays(date, -60))
      .lt("study_date", date)
      .not("recurrence_id", "is", null)
      .not("done_at", "is", null),
    supabase.from("timetables").select("*").is("deleted_at", null),
    supabase.from("timetable_slots").select("*").is("deleted_at", null),
    supabase.from("holidays").select("*").is("deleted_at", null),
    supabase.from("date_timetables").select("*").is("deleted_at", null),
  ]);
  for (const r of [recs, existing, done, timetables, slots, holidays, dateTimetables]) if (r.error) throw r.error;

  const existingIds = new Set((existing.data ?? []).map((t) => t.recurrence_id as string));
  const due = recurrencesDue(recs.data ?? [], date, existingIds);
  if (due.length === 0) return 0;

  const doneDates = new Map<string, Set<string>>();
  for (const t of done.data ?? []) {
    const key = t.recurrence_id as string;
    doneDates.set(key, (doneDates.get(key) ?? new Set()).add(t.study_date as string));
  }
  const ttId = timetableForDate(date, {
    timetables: timetables.data ?? [],
    holidays: holidays.data ?? [],
    dateTimetables: dateTimetables.data ?? [],
  });
  const daySlots = slotsOf(ttId, slots.data ?? []);

  const rows = due.map((r, i) => ({
    title: r.title,
    subject_id: r.subject_id,
    est_minutes: r.est_minutes,
    study_date: date,
    source: "recurrence" as const,
    recurrence_id: r.id,
    missed_streak: missedStreak(r, date, doneDates.get(r.id) ?? new Set()),
    sort_order: 1000 + i,
    ...defaultBlock(r, daySlots),
  }));
  const { error } = await supabase
    .from("tasks")
    .upsert(rows, { onConflict: "recurrence_id,study_date", ignoreDuplicates: true });
  if (error) throw error;
  void dayStartHour;
  return rows.length;
}

/** 기본 차시 이름이 그날 시간표에 있으면 그 차시로, 아니면 기본 시각으로 시간 블록을 잡는다 */
export function defaultBlock(
  r: Pick<RecurrenceRow, "default_slot_name" | "default_start_min" | "est_minutes">,
  slots: readonly TimetableSlotRow[],
): { slot_id: string | null; start_min: number | null; end_min: number | null } {
  if (r.default_slot_name) {
    const slot = slots.find((s) => s.name === r.default_slot_name);
    if (slot) return { slot_id: slot.id, start_min: slot.start_min, end_min: slot.end_min };
  }
  if (r.default_start_min !== null && r.default_start_min !== undefined) {
    const length = Math.max(10, snap(r.est_minutes ?? 30, "ceil"));
    return {
      slot_id: null,
      start_min: r.default_start_min,
      end_min: Math.min(1440, r.default_start_min + length),
    };
  }
  return { slot_id: null, start_min: null, end_min: null };
}
