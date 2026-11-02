"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { looseTable } from "@/lib/data/crud";
import { useProfile, useUpdateProfile } from "@/lib/data/profile";
import { useSaveErrorToast } from "@/lib/data/save-error";
import { useToday } from "@/lib/data/today";
import { requireSupabase } from "@/lib/supabase/client";
import { shiftDayMin } from "@/lib/timetable/time";

const HOURS = Array.from({ length: 13 }, (_, h) => h);
const label = (h: number) => (h === 0 ? "자정 (0시)" : h === 12 ? "낮 12시" : `오전 ${h}시`);

/**
 * 5.1 하루 기준 시각 (기본 오전 6시). 이 시각 전에 한 공부와 할 일은 전날 것으로 센다.
 * 바꾸면 시간표와 할 일의 시간 블록을 같은 시계 시각으로 옮긴다.
 */
export function DayStartSetting() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const onSaveError = useSaveErrorToast();
  const today = useToday();
  const [next, setNext] = useState<number | null>(null);
  const current = profile?.day_start_hour ?? 6;

  const apply = async (to: number) => {
    const from = current;
    updateProfile.mutate({ day_start_hour: to });
    try {
      const supabase = requireSupabase();
      const shift = (m: number | null) => (m === null ? null : shiftDayMin(m, from, to));
      const [slots, recs, ranges, tasks] = await Promise.all([
        supabase.from("timetable_slots").select("id, start_min, end_min"),
        supabase.from("recurrences").select("id, default_start_min").not("default_start_min", "is", null),
        supabase.from("range_items").select("id, default_start_min").not("default_start_min", "is", null),
        supabase.from("tasks").select("id, start_min, end_min").gte("study_date", today).not("start_min", "is", null),
      ]);
      for (const s of slots.data ?? []) {
        const start = shift(s.start_min) as number;
        const end = Math.min(1440, start + (s.end_min - s.start_min));
        if (end > start) await looseTable("timetable_slots").update({ start_min: start, end_min: end }).in("id", [s.id]);
      }
      for (const r of recs.data ?? []) {
        await looseTable("recurrences").update({ default_start_min: shift(r.default_start_min) }).in("id", [r.id]);
      }
      for (const r of ranges.data ?? []) {
        await looseTable("range_items").update({ default_start_min: shift(r.default_start_min) }).in("id", [r.id]);
      }
      for (const t of tasks.data ?? []) {
        const start = shift(t.start_min) as number;
        const end = Math.min(1440, start + ((t.end_min ?? start + 10) - (t.start_min ?? 0)));
        await looseTable("tasks")
          .update(end > start ? { start_min: start, end_min: end } : { start_min: null, end_min: null, slot_id: null })
          .in("id", [t.id]);
      }
    } catch (error) {
      onSaveError(error);
    } finally {
      void queryClient.invalidateQueries();
    }
  };

  return (
    <Card title="하루 기준 시각">
      <div className="flex flex-col gap-2">
        <SelectField
          label="하루가 바뀌는 시각"
          value={String(current)}
          onChange={(v) => setNext(Number(v))}
          options={HOURS.map((h) => ({ value: String(h), label: label(h) }))}
          className="max-w-60"
        />
        <p className="text-12 text-sub">이 시각 전에 한 공부와 할 일은 전날 것으로 세요.</p>
      </div>
      <ConfirmDialog
        open={next !== null && next !== current}
        title="하루 기준 시각을 바꿀까요?"
        message={`${label(current)} → ${label(next ?? current)}. 시간표와 할 일의 시간 블록은 같은 시각으로 옮겨요.`}
        confirmLabel="바꾸기"
        onConfirm={() => {
          if (next !== null) void apply(next);
        }}
        onClose={() => setNext(null)}
      />
    </Card>
  );
}
