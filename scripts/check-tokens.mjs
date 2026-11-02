#!/usr/bin/env node
/**
 * 디자인 토큰 검사 (spec 3장, 10.4):
 * 컴포넌트에 임의의 hex 색, px 값, 굵기 700 이상, 그림자, 그라데이션을 직접 쓰지 않았는지 본다.
 * 토큰은 src/app/globals.css 에만 값으로 둔다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const ALLOWED = new Set(["src/app/globals.css"]);
// 가짜 백엔드·테스트는 화면에 그리지 않는 코드라 검사에서 뺀다
const SKIP_DIRS = ["src/lib/supabase/fake"];

const RULES = [
  { re: /#[0-9a-fA-F]{3,8}\b(?![\w-])/g, why: "hex 색 직접 사용", test: (line) => !/&#|#main|#\d+\s*(번|회)/.test(line) },
  { re: /-\[[^\]]*\d+px[^\]]*\]/g, why: "Tailwind 임의 px 값" },
  { re: /\bfont-(bold|extrabold|black)\b/g, why: "굵기 700 이상" },
  { re: /\b(shadow|drop-shadow|bg-gradient|bg-linear|bg-radial)-/g, why: "그림자·그라데이션" },
  { re: /\b(text|bg|border|fill|stroke)-(white|black|red|blue|green|gray|slate|zinc|neutral)-?\d*/g, why: "Tailwind 기본 색" },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (SKIP_DIRS.some((d) => rel.startsWith(d))) continue;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (ALLOWED.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line) && (!rule.test || rule.test(line))) {
        problems.push(`${rel}:${i + 1}  ${rule.why}: ${line.trim()}`);
      }
    }
  });
}

if (problems.length) {
  console.error("디자인 토큰 밖의 값이 있어요:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("디자인 토큰 검사 통과");
