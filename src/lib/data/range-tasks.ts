"use client";

import { formatRange, todayPortion } from "@/lib/exam/range";
import { requireSupabase } from "@/lib/supabase/client";
import { slotsOf, timetableForDate } from "@/lib/timetable/resolve";
import { defaultBlock } from "./tasks";

/**
 * 6.5 범위 분배가 날마다 "수학 · 문제집 p.84–97" 같은 할 일을 만든다 (설정에서 끌 수 있음).
 * 같은 범위·같은 날짜는 하나만. 공부 가능일이 0 이하(총복습 기간)면 만들지 않는다.
 */
export async function ensureRangeTasks(date: string): Promise<number> {
  const supabase = requireSupabase();
  const [profile, ddays, items, dates, subjects, existing, timetables, slots, holidays, dateTables] = await Promise.all([
    supabase.from("profiles").select("auto_range_tasks").maybeSingle(),
    supabase.from("ddays").select("*").eq("type", "exam").gte("date", date).is("deleted_at", null),
    supabase.from("range_items").select("*").is("deleted_at", null),
    supabase.from("exam_subject_dates").select("*").is("deleted_at", null),
    supabase.from("subjects").select("id, name").is("deleted_at", null),
    supabase.from("tasks").select("range_item_id").eq("study_date", date).not("range_item_id", "is", null),
    supabase.from("timetables").select("*").is("deleted_at", null),
    supabase.from("timetable_slots").select("*").is("deleted_at", null),
    supabase.from("holidays").select("*").is("deleted_at", null),
    supabase.from("date_timetables").select("*").is("deleted_at", null),
  ]);
  for (const r of [profile, ddays, items, dates, subjects, existing, timetables, slots, holidays, dateTables]) {
    if (r.error) throw r.error;
  }
  if (profile.data && profile.data.auto_range_tasks === false) return 0;

  const exams = new Map((ddays.data ?? []).map((d) => [d.id, d]));
  const names = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  const have = new Set((existing.data ?? []).map((t) => t.range_item_id as string));
  const ttId = timetableForDate(date, {
    timetables: timetables.data ?? [],
    holidays: holidays.data ?? [],
    dateTimetables: dateTables.data ?? [],
  });
  const daySlots = slotsOf(ttId, slots.data ?? []);

  const rows = [];
  for (const item of items.data ?? []) {
    const exam = exams.get(item.dday_id);
    if (!exam || have.has(item.id) || !names.has(item.subject_id)) continue;
    const examDate = (dates.data ?? []).find((d) => d.dday_id === exam.id && d.subject_id === item.subject_id)?.date ?? exam.date;
    const portion = todayPortion(item, {
      today: date,
      examDate,
      reviewDays: exam.review_days,
      offWeekdays: exam.off_weekdays,
    });
    if (portion.kind !== "portion") continue;
    const title = `${names.get(item.subject_id)} · ${item.name} ${formatRange(item.unit_label, portion.from, portion.to)}`.slice(0, 60);
    rows.push({
      title,
      subject_id: item.subject_id,
      study_date: date,
      source: "range" as const,
      range_item_id: item.id,
      range_start_no: portion.from,
      range_end_no: portion.to,
      sort_order: 2000 + rows.length,
      ...defaultBlock(
        { default_slot_name: item.default_slot_name, default_start_min: item.default_start_min, est_minutes: null },
        daySlots,
      ),
    });
  }
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("tasks").upsert(rows, { onConflict: "range_item_id,study_date", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}
