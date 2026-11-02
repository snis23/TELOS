"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useDayStartHour } from "@/lib/data/profile";
import { useSaveErrorToast } from "@/lib/data/save-error";
import { ensureRecurrenceTasks, tasksKey, useDefer, useTaskMutations } from "@/lib/data/tasks";
import { useDayTimetable } from "@/lib/data/timetable";
import { addDays } from "@/lib/date/days";
import { requireSupabase } from "@/lib/supabase/client";
import type { TaskRow } from "@/lib/supabase/database.types";
import { matchSlot } from "@/lib/timetable/grid";
import { ruleFromForm, type TaskFormValues } from "./task-dialog";

export type Scope = "this" | "all";

/** 할 일 화면의 모든 저장 동작 (5.6, 5.7, 5.11) */
export function useTaskActions(date: string, tasks: readonly TaskRow[]) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const onSaveError = useSaveErrorToast();
  const dayStartHour = useDayStartHour();
  const { slots } = useDayTimetable(date);
  const { insert, update, trash, restore, reorder } = useTaskMutations();
  const recurrences = useTableMutations("recurrences");
  const { defer } = useDefer();
  const nextOrder = () => tasks.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1;

  const add = useCallback(
    async (v: TaskFormValues) => {
      const rule = ruleFromForm(v);
      if (!rule) {
        insert.mutate({
          rows: [
            {
              id: newId(),
              title: v.title,
              subject_id: v.subject_id,
              est_minutes: v.est_minutes,
              study_date: v.study_date,
              sort_order: v.study_date === date ? nextOrder() : 0,
              start_min: v.block ? v.start_min : null,
              end_min: v.block ? v.end_min : null,
              slot_id: v.slot_id,
            },
          ],
          appendTo: tasksKey(v.study_date),
        });
        return;
      }
      // 반복 할 일: 규칙을 저장하고 그날 몫을 바로 만든다
      const slot = slots.find((s) => s.id === v.slot_id);
      try {
        const { error } = await requireSupabase()
          .from("recurrences")
          .insert({
            id: newId(),
            title: v.title,
            subject_id: v.subject_id,
            est_minutes: v.est_minutes,
            rule,
            start_date: v.study_date,
            end_date: v.end_date,
            default_slot_name: slot?.name ?? null,
            default_start_min: !slot && v.block ? v.start_min : null,
          });
        if (error) throw error;
        await ensureRecurrenceTasks(v.study_date, dayStartHour);
      } catch (error) {
        onSaveError(error);
      } finally {
        void queryClient.invalidateQueries({ queryKey: ["recurrences"] });
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, tasks, slots, dayStartHour],
  );

  const edit = useCallback(
    async (task: TaskRow, v: TaskFormValues, scope: Scope = "this") => {
      const patch = {
        title: v.title,
        subject_id: v.subject_id,
        est_minutes: v.est_minutes,
        study_date: v.study_date,
        start_min: v.block ? v.start_min : null,
        end_min: v.block ? v.end_min : null,
        slot_id: v.slot_id,
      };
      update.mutate({ ids: [task.id], patch });
      if (scope === "all" && task.recurrence_id) {
        const slot = slots.find((s) => s.id === v.slot_id);
        recurrences.update.mutate({
          ids: [task.recurrence_id],
          patch: {
            title: v.title,
            subject_id: v.subject_id,
            est_minutes: v.est_minutes,
            default_slot_name: slot?.name ?? null,
            default_start_min: !slot && v.block ? v.start_min : null,
          },
        });
        // 이미 만들어진 앞으로의 할 일도 함께 바꾼다
        const { data } = await requireSupabase()
          .from("tasks")
          .select("id")
          .eq("recurrence_id", task.recurrence_id)
          .gt("study_date", task.study_date)
          .is("done_at", null)
          .is("deleted_at", null);
        const ids = (data ?? []).map((r) => r.id);
        if (ids.length) {
          update.mutate({ ids, patch: { title: v.title, subject_id: v.subject_id, est_minutes: v.est_minutes } });
        }
      }
    },
    [update, recurrences.update, slots],
  );

  const remove = useCallback(
    async (task: TaskRow, scope: Scope = "this") => {
      if (scope === "all" && task.recurrence_id) {
        const recurrenceId = task.recurrence_id;
        trash.mutate({ id: task.id, silent: true });
        try {
          const { error } = await requireSupabase().rpc("trash_item", { p_table: "recurrences", p_id: recurrenceId });
          if (error) throw error;
          toast.show({
            message: "반복을 삭제했어요",
            action: {
              label: "되돌리기",
              onClick: () => {
                restore.mutate(task.id);
                restore.mutate(recurrenceId);
              },
            },
          });
        } catch (error) {
          onSaveError(error);
        }
        return;
      }
      trash.mutate({ id: task.id });
    },
    [trash, restore, toast, onSaveError],
  );

  const toggleDone = useCallback(
    (task: TaskRow, done: boolean) => {
      update.mutate({ ids: [task.id], patch: { done_at: done ? new Date().toISOString() : null } });
      if (task.range_item_id && task.range_start_no !== null && task.range_end_no !== null) {
        // 범위 분배에서 온 할 일: 체크하면 범위 진행률에 반영 (6.5)
        void applyRangeProgress(task.range_item_id, (task.range_end_no - task.range_start_no + 1) * (done ? 1 : -1)).then(
          () => queryClient.invalidateQueries({ queryKey: ["range_items"] }),
          (error) => onSaveError(error),
        );
      }
    },
    [update, queryClient, onSaveError],
  );

  const deferOne = useCallback(
    (task: TaskRow) => defer.mutate({ ids: [task.id], to: addDays(task.study_date, 1), message: () => "내일로 넘겼어요" }),
    [defer],
  );

  const deferMany = useCallback(
    (ids: string[]) => defer.mutate({ ids, to: addDays(date, 1), message: (n) => `${n}개를 내일로 넘겼어요` }),
    [defer, date],
  );

  const bringToToday = useCallback(
    (ids: string[]) => defer.mutate({ ids, to: date, message: (n) => `${n}개를 오늘로 가져왔어요` }),
    [defer, date],
  );

  const setMustDo = useCallback((task: TaskRow) => update.mutate({ ids: [task.id], patch: { must_do: true } }), [update]);

  /** 쪼개기: 2~3개의 작은 할 일로 나누고 원래 항목은 지운다. 새 항목의 미룬 횟수는 0 */
  const split = useCallback(
    (task: TaskRow, titles: string[]) => {
      insert.mutate({
        rows: titles.map((title, i) => ({
          id: newId(),
          title,
          subject_id: task.subject_id,
          study_date: task.study_date,
          sort_order: task.sort_order + i,
          est_minutes: task.est_minutes ? Math.max(5, Math.round(task.est_minutes / titles.length)) : null,
        })),
        appendTo: tasksKey(task.study_date),
      });
      trash.mutate({ id: task.id, silent: true });
      toast.show({ message: `${titles.length}개로 쪼갰어요` });
    },
    [insert, trash, toast],
  );

  const reorderTasks = useCallback((ids: string[]) => reorder.mutate({ ids, key: tasksKey(date) }), [reorder, date]);

  /** 시간 보기에서 옮기거나 늘린 블록: 차시와 정확히 맞으면 배정, 벗어나면 배정만 푼다 */
  const setBlock = useCallback(
    (task: TaskRow, start: number, end: number) => {
      const slot = matchSlot(start, end, slots);
      update.mutate({ ids: [task.id], patch: { start_min: start, end_min: end, slot_id: slot?.id ?? null } });
    },
    [update, slots],
  );

  /** 시간표 보기에서 차시에 배정: 시간 블록을 그 차시 시간으로 채운다 */
  const assignSlot = useCallback(
    (task: TaskRow, slotId: string | null) => {
      const slot = slots.find((s) => s.id === slotId);
      update.mutate({
        ids: [task.id],
        patch: slot ? { slot_id: slot.id, start_min: slot.start_min, end_min: slot.end_min } : { slot_id: null },
      });
    },
    [update, slots],
  );

  return { add, edit, remove, toggleDone, deferOne, deferMany, bringToToday, setMustDo, split, reorderTasks, setBlock, assignSlot };
}

/** 범위 항목의 끝낸 양을 더하거나 뺀다 (0 아래로는 내려가지 않는다) */
async function applyRangeProgress(rangeItemId: string, delta: number) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("range_items").select("done_amount").eq("id", rangeItemId).maybeSingle();
  if (error) throw error;
  if (!data) return;
  const next = Math.max(0, data.done_amount + delta);
  const res = await supabase.from("range_items").update({ done_amount: next }).eq("id", rangeItemId);
  if (res.error) throw res.error;
}

export type TaskActions = ReturnType<typeof useTaskActions>;
