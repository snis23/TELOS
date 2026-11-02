import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** 3장: 화면에 쓰는 글자 색은 배경 대비 4.5:1 이상 */
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) vars[m[1]] = m[2];
  return vars;
}
const light = block('[data-theme="light"]');
const dark = { ...light, ...block('[data-theme="dark"]') };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** 이 앱에서 실제로 쓰는 글자·바탕 조합 */
const PAIRS: [string, string][] = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink", "surface-2"],
  ["ink-2", "surface"],
  ["ink-2", "surface-2"],
  ["sub", "bg"],
  ["sub", "surface"],
  ["accent", "surface"],
  ["accent", "bg"],
  ["accent", "timer-bg"],
  ["accent-strong", "nav-on"],
  ["btn-ink", "btn"],
  ["nap-ink", "nap-soft"],
  ["ok-ink", "ok-soft"],
  ["ok-ink", "surface"],
  ["urgent-ink", "urgent-bg"],
  ["urgent-ink", "surface"],
  ["warn-ink", "warn-bg"],
  ["normal-ink", "normal-bg"],
  ["ink", "timer-bg"],
];

describe("글자 대비 4.5:1", () => {
  for (const [name, theme] of [
    ["라이트", light],
    ["다크", dark],
  ] as const) {
    for (const [fg, bg] of PAIRS) {
      it(`${name}: ${fg} / ${bg}`, () => {
        expect(theme[fg], fg).toBeDefined();
        expect(theme[bg], bg).toBeDefined();
        expect(ratio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("과목 태그 글자 (8색, 라이트·다크)", () => {
    for (const key of ["rose", "periwinkle", "mint", "butter", "lavender", "peach", "sky", "sage"]) {
      expect(ratio(light[`subject-${key}-tag-ink`], light[`subject-${key}-tag`])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(dark[`subject-${key}-tag-ink`], dark[`subject-${key}-tag`])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
