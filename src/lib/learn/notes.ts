import type { MockRoundRow, NoteKind, NoteReason, UnitRow, WrongNoteRow } from "@/lib/supabase/database.types";

/** 7장 오답노트 */

export const REASON_LABELS: Record<NoteReason, string> = { concept: "개념 부족", slip: "계산 실수", time: "시간 부족" };
/** 틀린 이유 태그 색: 개념 부족은 긴급, 계산 실수는 주의, 시간 부족은 보통 (3.2) */
export const REASON_TONES = { concept: "urgent", slip: "warn", time: "normal" } as const;
export const KIND_LABELS: Record<NoteKind, string> = { school: "내신", mock: "모의고사" };
export const MAX_PHOTOS = 5;

type N = Pick<WrongNoteRow, "solved_at" | "reason" | "deleted_at">;

export function noteSummary(notes: readonly N[]): { unsolved: number; solved: number; topReason: NoteReason | null } {
  const live = notes.filter((n) => !n.deleted_at);
  const counts = new Map<NoteReason, number>();
  for (const n of live) counts.set(n.reason, (counts.get(n.reason) ?? 0) + 1);
  let topReason: NoteReason | null = null;
  for (const [reason, count] of counts) if (!topReason || count > (counts.get(topReason) ?? 0)) topReason = reason;
  return {
    unsolved: live.filter((n) => !n.solved_at).length,
    solved: live.filter((n) => n.solved_at).length,
    topReason,
  };
}

export type NoteGroup<T> = { key: string; label: string; notes: T[] };

/** 내신은 단원 순서대로 "지수 단원 · 3", 모의고사는 최신 회차부터 "2026년 10월 모의고사 · 2" */
export function groupNotes<T extends Pick<WrongNoteRow, "kind" | "unit_id" | "mock_round_id" | "created_at">>(
  notes: readonly T[],
  kind: NoteKind,
  units: readonly Pick<UnitRow, "id" | "name" | "sort_order">[],
  rounds: readonly Pick<MockRoundRow, "id" | "name" | "year" | "month">[],
): NoteGroup<T>[] {
  const sorted = [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (kind === "school") {
    return [...units]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((u) => ({ key: u.id, label: `${u.name} 단원`, notes: sorted.filter((n) => n.unit_id === u.id) }))
      .filter((g) => g.notes.length);
  }
  const groups = [...rounds]
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .map((r) => ({ key: r.id, label: r.name, notes: sorted.filter((n) => n.mock_round_id === r.id) }))
    .filter((g) => g.notes.length);
  return groups;
}

export function defaultRoundName(year: number, month: number): string {
  return `${year}년 ${month}월 모의고사`;
}

/** 사진 경로: <user_id>/<note_id>/<photo_id>.jpg (Storage 정책이 첫 폴더를 본인 id 로 확인한다) */
export function photoPath(userId: string, noteId: string, photoId: string): string {
  return `${userId}/${noteId}/${photoId}.jpg`;
}
