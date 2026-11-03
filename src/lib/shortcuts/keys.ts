import type { KeyCombo } from "./guard";

/** Alt(Option) + 1~5: 메뉴 이동 (오늘, 스케줄, 계획, 학습, 기록) */
export const NAV_COMBOS: readonly KeyCombo[] = [1, 2, 3, 4, 5].map((n) => ({
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
  { keys: ["Space"], label: "타이머 시작 / 일시정지", ready: true },
  { keys: ["1~8"], label: "과목 전환", ready: true },
  { keys: ["N"], label: "쪽잠 시작 / 끝", ready: true },
  { keys: ["F"], label: "집중 모드", ready: true },
  { keys: ["A"], label: "할 일 추가", ready: true },
  { keys: ["Shift", "D"], label: "못 한 일 내일로 넘기기", ready: true },
  { keys: ["V"], label: "할 일 보기 전환", ready: true },
  { keys: ["←", "→"], label: "전날 / 다음 날", ready: true },
  { keys: ["Alt(⌥)", "1~5"], label: "메뉴 이동", ready: true },
  { keys: ["Shift", "T"], label: "다크 모드 전환", ready: true },
  { keys: ["Esc"], label: "창 닫기, 집중 모드 나가기", ready: true },
];
