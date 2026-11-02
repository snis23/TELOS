/** 3.3 과목 색 팔레트. 실제 색 값은 globals.css 의 --subject-* 토큰에 있다. */
export const SUBJECT_COLOR_KEYS = [
  "rose",
  "periwinkle",
  "mint",
  "butter",
  "lavender",
  "peach",
  "sky",
  "sage",
] as const;

export type SubjectColorKey = (typeof SUBJECT_COLOR_KEYS)[number];

/** 색 고르기 버튼의 읽기용 이름 */
export const SUBJECT_COLOR_LABELS: Record<SubjectColorKey, string> = {
  rose: "로즈",
  periwinkle: "페리윙클",
  mint: "민트",
  butter: "버터",
  lavender: "라벤더",
  peach: "피치",
  sky: "스카이",
  sage: "세이지",
};

export function isSubjectColorKey(value: unknown): value is SubjectColorKey {
  return typeof value === "string" && (SUBJECT_COLOR_KEYS as readonly string[]).includes(value);
}

/** 새 과목에 줄 색: 아직 안 쓴 색 중 첫 번째, 다 썼으면 가장 적게 쓴 색 */
export function pickNextColor(used: readonly SubjectColorKey[]): SubjectColorKey {
  const counts = new Map<SubjectColorKey, number>(SUBJECT_COLOR_KEYS.map((k) => [k, 0]));
  for (const key of used) counts.set(key, (counts.get(key) ?? 0) + 1);
  let best: SubjectColorKey = SUBJECT_COLOR_KEYS[0];
  for (const key of SUBJECT_COLOR_KEYS) {
    if ((counts.get(key) ?? 0) < (counts.get(best) ?? 0)) best = key;
  }
  return best;
}
