"use client";

import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SubjectColorKey } from "@/lib/design/subject-colors";

export type Series = { key: string; name: string; color: SubjectColorKey | "accent" };

const MONO = "var(--font-mono)";
const strokeOf = (c: Series["color"]) => (c === "accent" ? "var(--check)" : `var(--subject-${c}-dot)`);

/**
 * 성적 꺾은선 그래프 (8.2, 8.3):
 * 선 2px 과목 점 색, 점은 흰 바탕 + 2px 테두리, 점 위에 값(Mono 10px), 격자선은 --line 점선 3개.
 * 등급은 1 이 위에 오도록 세로축을 뒤집는다. 값과 축 글자는 글자 토큰을 쓴다(선 색 아님).
 */
export function GradeLineChart({
  data,
  series,
  domain,
  reversed,
  format = (v) => String(v),
  height = 240,
  label,
}: {
  data: Record<string, string | number | null>[];
  series: readonly Series[];
  domain: [number, number];
  reversed?: boolean;
  format?: (v: number) => string;
  height?: number;
  label: string;
}) {
  const ticks = [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
  return (
    <figure aria-label={label} className="flex flex-col gap-2">
      <div style={{ height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              tickLine={false}
              axisLine={false}
              tick={{ fontFamily: MONO, fontSize: 10, fill: "var(--sub)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={domain}
              ticks={ticks}
              reversed={reversed}
              allowDecimals
              tickLine={false}
              axisLine={false}
              width={32}
              tick={{ fontFamily: MONO, fontSize: 10, fill: "var(--sub)" }}
              tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
            />
            <Tooltip
              cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--radius-input)",
                fontSize: 12,
                color: "var(--ink)",
              }}
              labelStyle={{ color: "var(--sub)", fontFamily: MONO, fontSize: 11 }}
              formatter={(v, name) => [typeof v === "number" ? format(v) : String(v ?? "–"), String(name)]}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.name}
                stroke={strokeOf(s.color)}
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                dot={{ r: 4, fill: "var(--surface)", stroke: strokeOf(s.color), strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "var(--surface)", stroke: strokeOf(s.color), strokeWidth: 2 }}
              >
                <LabelList
                  dataKey={s.key}
                  position="top"
                  offset={8}
                  style={{ fontFamily: MONO, fontSize: 10, fill: "var(--ink-2)" }}
                  formatter={(v: unknown) => (typeof v === "number" ? format(v) : "")}
                />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {series.length >= 2 ? (
        <figcaption className="flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-11 text-ink-2">
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: strokeOf(s.color) }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
