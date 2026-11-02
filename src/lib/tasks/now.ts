import type { TaskRow } from "@/lib/supabase/database.types";

type T = Pick<TaskRow, "id" | "done_at" | "start_min" | "end_min" | "slot_id" | "sort_order" | "must_do" | "deferred_count">;

export type NowTask<X extends T> = { task: X; kind: "now" | "next" | "todo" } | null;

/**
 * 오늘 화면의 "지금 할 일":
 * 1) 지금 시각이 들어가는 시간 블록의 할 일 → 2) 지금 차시에 배정한 할 일
 * → 3) 다음에 시작하는 시간 블록의 할 일 → 4) 아직 안 끝낸 첫 할 일 (꼭 하기·많이 미룬 것 먼저)
 */
export function pickNowTask<X extends T>(tasks: readonly X[], nowMin: number, currentSlotId: string | null): NowTask<X> {
  const open = tasks.filter((t) => !t.done_at);
  if (open.length === 0) return null;
  const byStart = (a: X, b: X) => (a.start_min ?? 0) - (b.start_min ?? 0) || a.sort_order - b.sort_order;
  const inBlock = open
    .filter((t) => t.start_min != null && t.end_min != null && t.start_min <= nowMin && nowMin < t.end_min)
    .sort(byStart);
  if (inBlock[0]) return { task: inBlock[0], kind: "now" };
  if (currentSlotId) {
    const inSlot = open.filter((t) => t.slot_id === currentSlotId).sort((a, b) => a.sort_order - b.sort_order);
    if (inSlot[0]) return { task: inSlot[0], kind: "now" };
  }
  const upcoming = open.filter((t) => t.start_min != null && t.start_min > nowMin).sort(byStart);
  if (upcoming[0]) return { task: upcoming[0], kind: "next" };
  const rest = [...open].sort(
    (a, b) => Number(b.must_do) - Number(a.must_do) || b.deferred_count - a.deferred_count || a.sort_order - b.sort_order,
  );
  return { task: rest[0], kind: "todo" };
}
