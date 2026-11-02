import type { TaskRow } from "@/lib/supabase/database.types";

/**
 * 5.7 미룬 할 일 강조.
 * 일반 할 일은 미룬 횟수, 반복 할 일은 연속으로 못 한 횟수로 단계를 정한다.
 */
export type DeferLevel = 0 | 1 | 2 | 3;

type T = Pick<TaskRow, "source" | "deferred_count" | "missed_streak">;

export function deferCount(task: T): number {
  return task.source === "recurrence" ? task.missed_streak : task.deferred_count;
}

export function deferLevel(task: T): DeferLevel {
  const n = deferCount(task);
  if (n >= 3) return 3;
  return n as DeferLevel;
}

type Sortable = T & Pick<TaskRow, "id" | "must_do" | "done_at" | "sort_order" | "created_at">;

/** 정렬 순위: 0 = 맨 위 고정(3번 이상, 오늘 꼭 하기), 1 = 2번 미룸, 2 = 나머지 */
export function deferRank(task: Sortable): number {
  if (task.must_do || deferLevel(task) === 3) return 0;
  if (deferLevel(task) === 2) return 1;
  return 2;
}

/** 목록 순서: 안 끝낸 일(미루기 강조 → 사용자가 정한 순서) → 끝낸 일 */
export function sortTasks<X extends Sortable>(tasks: readonly X[]): X[] {
  return [...tasks].sort((a, b) => {
    const doneA = a.done_at ? 1 : 0;
    const doneB = b.done_at ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    if (!a.done_at) {
      const r = deferRank(a) - deferRank(b);
      if (r !== 0) return r;
    }
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** 넘기기·가져오기 대상이 되는 "일반 할 일" (반복·범위 분배는 매일 다시 만든다) */
export function isPlainTask(task: Pick<TaskRow, "source">): boolean {
  return task.source === "manual" || task.source === "goal";
}

/** 한 번에 넘기기 대상: 안 끝낸 일반 할 일, 오늘 꼭 하기 제외 (5.6) */
export function bulkDeferTargets<X extends Pick<TaskRow, "source" | "done_at" | "must_do">>(tasks: readonly X[]): X[] {
  return tasks.filter((t) => !t.done_at && isPlainTask(t) && !t.must_do);
}

/** 지난 할 일 확인: 지난 날짜에 안 끝낸 일반 할 일 */
export function staleTasks<X extends Pick<TaskRow, "source" | "done_at" | "study_date" | "deleted_at">>(
  tasks: readonly X[],
  today: string,
): X[] {
  return tasks.filter((t) => !t.deleted_at && !t.done_at && isPlainTask(t) && t.study_date < today);
}

/** 강조 문구 */
export function deferLabel(task: T): string | null {
  const n = deferCount(task);
  if (n <= 0) return null;
  if (n === 1) return task.source === "recurrence" ? "지난번에 못 함" : "어제에서 넘어옴";
  return `${n}번 미룸`;
}
