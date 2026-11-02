"use client";

import { useEffect, useRef } from "react";
import { matchesCombo, shouldIgnoreShortcut, type GuardOptions, type KeyCombo } from "./guard";

/**
 * 전역 단축키를 등록한다. 맞는 키가 눌리면 브라우저 기본 동작을 막고 핸들러를 부른다.
 * 여러 키를 넘기면 핸들러의 두 번째 인자로 몇 번째 키인지 알려 준다.
 */
export function useShortcut(
  combos: KeyCombo | readonly KeyCombo[],
  handler: (event: KeyboardEvent, index: number) => void,
  options: GuardOptions & { enabled?: boolean } = {},
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const list = Array.isArray(combos) ? (combos as readonly KeyCombo[]) : [combos as KeyCombo];
  const key = JSON.stringify(list);
  const { enabled = true, allowInEditable, allowWithDialog } = options;

  useEffect(() => {
    if (!enabled) return;
    const parsed = JSON.parse(key) as KeyCombo[];
    const onKeyDown = (event: KeyboardEvent) => {
      const index = parsed.findIndex((combo) => matchesCombo(event, combo));
      if (index === -1) return;
      if (shouldIgnoreShortcut(event, { allowInEditable, allowWithDialog })) return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      handlerRef.current(event, index);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled, allowInEditable, allowWithDialog]);
}
