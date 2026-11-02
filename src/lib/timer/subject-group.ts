"use client";

import { useSyncExternalStore } from "react";
import type { SubjectKind, SubjectRow } from "@/lib/supabase/database.types";

/**
 * 타이머 과목 칩은 모의고사 / 내신 중 한 묶음만 보여 준다.
 * 타이머 카드, 숫자 단축키(1~8), 집중 모드가 같은 값을 쓴다. 마지막 선택은 기기에 기억한다.
 */
const KEY = "telos:timer-group";
const listeners = new Set<() => void>();
let current: SubjectKind | null = null;

function read(): SubjectKind {
  if (current) return current;
  try {
    current = window.localStorage.getItem(KEY) === "school" ? "school" : "mock";
  } catch {
    current = "mock";
  }
  return current;
}

export function setSubjectGroup(group: SubjectKind) {
  current = group;
  try {
    window.localStorage.setItem(KEY, group);
  } catch {
    // 기억하지 못해도 이번 세션 동안은 동작한다
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSubjectGroup(): [SubjectKind, (group: SubjectKind) => void] {
  const group = useSyncExternalStore(subscribe, read, () => "mock" as const);
  return [group, setSubjectGroup];
}

export const GROUP_LABELS: Record<SubjectKind, string> = { mock: "모의고사", school: "내신" };

/** 고르는 목록(모의고사 → 내신 순서)에서 한 묶음만 */
export function subjectsInGroup(pickable: readonly SubjectRow[], group: SubjectKind): SubjectRow[] {
  return pickable.filter((s) => s.kind === group);
}
