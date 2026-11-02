"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 10, 20, 30, 40, 50];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 10분 단위 시각 고르기 (시계 시각, 자정부터 센 분). 시와 분을 따로 고른다.
 * firstHour 를 주면 그 시각부터 목록을 시작한다 (하루 기준 시각).
 */
export function TimeSelect({
  label,
  value,
  onChange,
  firstHour = 0,
  error,
  className,
}: {
  label: string;
  value: number;
  onChange: (clockMin: number) => void;
  firstHour?: number;
  error?: string;
  className?: string;
}) {
  const id = useId();
  const h = Math.floor(value / 60) % 24;
  const m = value % 60;
  const hours = [...HOURS.slice(firstHour), ...HOURS.slice(0, firstHour)];
  const selectClass =
    "control-h appearance-none rounded-input bg-surface-2 px-3 text-center text-13 text-ink num outline-none focus-visible:outline-2 focus-visible:outline-check";
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <legend className="mb-1.5 text-12 text-sub">{label}</legend>
      <div className="flex items-center gap-1">
        <select
          id={`${id}-h`}
          aria-label={`${label} 시`}
          value={h}
          onChange={(e) => onChange(Number(e.target.value) * 60 + m)}
          className={selectClass}
        >
          {hours.map((x) => (
            <option key={x} value={x}>
              {pad(x)}
            </option>
          ))}
        </select>
        <span className="text-13 text-sub">:</span>
        <select
          id={`${id}-m`}
          aria-label={`${label} 분`}
          value={m - (m % 10)}
          onChange={(e) => onChange(h * 60 + Number(e.target.value))}
          className={selectClass}
        >
          {MINUTES.map((x) => (
            <option key={x} value={x}>
              {pad(x)}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-12 text-urgent-ink">{error}</p> : null}
    </fieldset>
  );
}
