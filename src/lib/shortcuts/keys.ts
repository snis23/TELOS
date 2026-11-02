import type { KeyCombo } from "./guard";

/** Alt(Option) + 1~6: 메뉴 이동 (오늘, 계획, 시험, 학습, 기록, 성적) */
export const NAV_COMBOS: readonly KeyCombo[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  code: `Digit${n}`,
  alt: true,
}));

export const THEME_TOGGLE_COMBO: KeyCombo = { code: "KeyT", shift: true };
export const ESCAPE_COMBO: KeyCombo = { code: "Escape" };

export type ShortcutRow = {
  /** 키 이름들. 여러 개면 "+" 로 이어 보여 준다 */
  keys: readonly string[];
  label: string;
  /** 이 단계에서 실제로 동작하는지. 동작하는 것만 단축키 표에 보여 준다 */
  ready: boolean;
};

/** 4.3 단축키 표. 기능이 만들어지는 단계에서 ready 를 켠다. */
export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
  { keys: ["Space"], label: "타이머 시작 / 일시정지", ready: false },
  { keys: ["1~8"], label: "과목 전환", ready: false },
  { keys: ["N"], label: "쪽잠 시작 / 끝", ready: false },
  { keys: ["F"], label: "집중 모드", ready: false },
  { keys: ["A"], label: "할 일 추가", ready: false },
  { keys: ["Shift", "D"], label: "못 한 일 내일로 넘기기", ready: false },
  { keys: ["V"], label: "할 일 보기 전환", ready: false },
  { keys: ["←", "→"], label: "전날 / 다음 날", ready: false },
  { keys: ["Alt(⌥)", "1~6"], label: "메뉴 이동", ready: true },
  { keys: ["Shift", "T"], label: "다크 모드 전환", ready: true },
  { keys: ["Esc"], label: "창 닫기", ready: true },
];
