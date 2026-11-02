/**
 * 4.3 단축키 동작 조건.
 * - 입력칸에 쓰는 중이거나 창이 열려 있으면 동작하지 않는다 (Esc 는 예외).
 * - 브라우저 기본 단축키와 겹치는 Ctrl·⌘ 조합은 쓰지 않는다.
 * - 키는 event.code 로 판별한다 (한글 입력 상태에서도 동작).
 */

export type KeyCombo = {
  /** KeyboardEvent.code, 예: "KeyT", "Digit1", "Space", "Escape" */
  code: string;
  shift?: boolean;
  alt?: boolean;
};

type KeyLike = Pick<KeyboardEvent, "code" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey">;

export function matchesCombo(event: KeyLike, combo: KeyCombo): boolean {
  return (
    event.code === combo.code &&
    event.shiftKey === Boolean(combo.shift) &&
    event.altKey === Boolean(combo.alt) &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "password",
  "number",
  "tel",
  "url",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
]);

/** 글자를 쓰는 곳인지: 입력칸, 여러 줄 입력칸, 선택 상자, 편집 가능한 요소 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  return el.closest("[contenteditable=''], [contenteditable='true']") !== null;
}

/** Space 나 Enter 가 원래 동작(누르기)을 하는 요소인지 */
export function isActivatableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  return (
    (target as Element).closest(
      "button, a[href], summary, input, select, textarea, [role='button'], [role='switch'], [role='checkbox'], [role='radio'], [role='tab'], [role='menuitem'], [role='option']",
    ) !== null
  );
}

/** 열린 창(가운데 창, 아래 시트)이 있는지 */
export function isDialogOpen(doc: Document = document): boolean {
  return doc.querySelector("dialog[open], [role='dialog'][aria-modal='true']") !== null;
}

export type GuardOptions = {
  /** Esc 처럼 입력 중에도 동작해야 하는 키 */
  allowInEditable?: boolean;
  /** 창이 열려 있어도 동작해야 하는 키 */
  allowWithDialog?: boolean;
};

/** 이 키 입력을 단축키로 처리하면 안 되는지 */
export function shouldIgnoreShortcut(
  event: KeyboardEvent,
  options: GuardOptions = {},
  doc: Document = document,
): boolean {
  if (event.defaultPrevented) return true;
  if (event.isComposing) return true;
  if (event.ctrlKey || event.metaKey) return true;
  if (!options.allowInEditable && isEditableTarget(event.target)) return true;
  if (!options.allowWithDialog && isDialogOpen(doc)) return true;
  // 버튼에 포커스가 있을 때 Space·Enter 는 그 버튼을 누르는 키로 둔다
  if ((event.code === "Space" || event.code === "Enter") && isActivatableTarget(event.target)) {
    return true;
  }
  return false;
}
