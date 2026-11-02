import { afterEach, describe, expect, it } from "vitest";
import { isEditableTarget, matchesCombo, shouldIgnoreShortcut } from "./guard";
import { NAV_COMBOS, THEME_TOGGLE_COMBO } from "./keys";

function keydown(code: string, init: KeyboardEventInit = {}, target?: Element) {
  const event = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true, ...init });
  if (target) Object.defineProperty(event, "target", { value: target });
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("단축키 판별 (4.3)", () => {
  it("event.code 로 판별해 한글 입력 상태에서도 맞다", () => {
    const e = keydown("KeyT", { key: "ㅅ", shiftKey: true });
    expect(matchesCombo(e, THEME_TOGGLE_COMBO)).toBe(true);
  });

  it("수정 키가 다르면 맞지 않다", () => {
    expect(matchesCombo(keydown("KeyT"), THEME_TOGGLE_COMBO)).toBe(false);
    expect(matchesCombo(keydown("Digit1", { altKey: true }), NAV_COMBOS[0])).toBe(true);
    expect(matchesCombo(keydown("Digit1"), NAV_COMBOS[0])).toBe(false);
  });

  it("Ctrl·⌘ 조합은 쓰지 않는다", () => {
    expect(matchesCombo(keydown("Digit1", { altKey: true, ctrlKey: true }), NAV_COMBOS[0])).toBe(false);
    expect(shouldIgnoreShortcut(keydown("KeyT", { metaKey: true, shiftKey: true }))).toBe(true);
  });
});

describe("입력 중이거나 창이 열려 있으면 동작하지 않는다", () => {
  it("입력칸·여러 줄 입력칸·편집 가능한 요소", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(input, textarea, editable);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(shouldIgnoreShortcut(keydown("KeyT", { shiftKey: true }, input))).toBe(true);
    expect(shouldIgnoreShortcut(keydown("KeyT", { shiftKey: true }, textarea))).toBe(true);
  });

  it("체크박스는 글자 입력이 아니다", () => {
    const box = document.createElement("input");
    box.type = "checkbox";
    expect(isEditableTarget(box)).toBe(false);
  });

  it("창이 열려 있으면 무시, Esc 는 예외로 허용할 수 있다", () => {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    expect(shouldIgnoreShortcut(keydown("KeyT", { shiftKey: true }, document.body))).toBe(true);
    expect(
      shouldIgnoreShortcut(keydown("Escape", {}, document.body), { allowWithDialog: true, allowInEditable: true }),
    ).toBe(false);
  });

  it("Esc 는 입력 중에도 허용할 수 있다", () => {
    const input = document.createElement("input");
    document.body.append(input);
    expect(shouldIgnoreShortcut(keydown("Escape", {}, input), { allowInEditable: true })).toBe(false);
  });

  it("버튼에 포커스가 있으면 Space 는 버튼 누르기로 둔다", () => {
    const button = document.createElement("button");
    document.body.append(button);
    expect(shouldIgnoreShortcut(keydown("Space", {}, button))).toBe(true);
    expect(shouldIgnoreShortcut(keydown("Space", {}, document.body))).toBe(false);
  });

  it("한글 조합 중이면 무시", () => {
    expect(shouldIgnoreShortcut(keydown("KeyN", { isComposing: true }, document.body))).toBe(true);
  });

  it("아무것도 없으면 동작", () => {
    expect(shouldIgnoreShortcut(keydown("KeyT", { shiftKey: true }, document.body))).toBe(false);
  });
});
