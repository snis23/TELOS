/** 7.4 암기 카드 */

export const FRONT_MAX = 200;
export const BACK_MAX = 500;

export type ParsedCards = { cards: { front: string; back: string }[]; errorLines: number[] };

/**
 * 여러 장 한 번에 추가: 한 줄에 "앞면 | 뒷면". 형식이 틀린 줄은 저장하지 않고 몇 번째 줄인지 알려 준다.
 * 빈 줄은 건너뛴다. 뒷면에 | 가 더 있으면 뒷면에 그대로 둔다.
 */
export function parseBulkCards(text: string): ParsedCards {
  const cards: ParsedCards["cards"] = [];
  const errorLines: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === "") return;
    const at = line.indexOf("|");
    if (at === -1) {
      errorLines.push(i + 1);
      return;
    }
    const front = line.slice(0, at).trim();
    const back = line.slice(at + 1).trim();
    if (!front || !back || front.length > FRONT_MAX || back.length > BACK_MAX) {
      errorLines.push(i + 1);
      return;
    }
    cards.push({ front, back });
  });
  return { cards, errorLines };
}

/** 외우기 순서: 모름 카드를 먼저 섞어서, 그다음 외운 카드 (모름만 보기면 모름만) */
export function studyOrder<C extends { known: boolean }>(cards: readonly C[], onlyUnknown: boolean, random: () => number = Math.random): C[] {
  const shuffle = (list: C[]) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const unknown = shuffle(cards.filter((c) => !c.known));
  if (onlyUnknown) return unknown;
  return [...unknown, ...shuffle(cards.filter((c) => c.known))];
}
