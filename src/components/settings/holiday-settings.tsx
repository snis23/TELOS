"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useHolidays } from "@/lib/data/timetable";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";

/** 5.10 공휴일: 처음 목록은 2026~2028 법정 공휴일. 확인하고 고친다 */
export function HolidaySettings() {
  const { data } = useHolidays();
  const { insert, trash } = useTableMutations("holidays", { unique: "그 날짜는 이미 공휴일이에요" });
  const [adding, setAdding] = useState(false);
  const years = [...new Set((data ?? []).map((h) => h.date.slice(0, 4)))].sort();
  const [year, setYear] = useState<string | null>(null);
  const shown = year ?? years.find((y) => y >= new Date().getFullYear().toString()) ?? years[0];

  return (
    <Card
      title="공휴일"
      actions={
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          공휴일 추가
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="연도" className="flex gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="tab"
              aria-selected={y === shown}
              onClick={() => setYear(y)}
              className={`num control-h rounded-full px-3.5 text-13 ${y === shown ? "bg-nav-on font-semibold text-accent-strong" : "bg-surface-2 text-ink-2"}`}
            >
              {y}
            </button>
          ))}
        </div>
        <ul className="flex flex-col">
          {(data ?? [])
            .filter((h) => h.date.startsWith(shown ?? ""))
            .map((h) => (
              <li key={h.id} className="flex min-h-10 items-center gap-3 border-b border-line last:border-b-0">
                <span className="w-28 shrink-0 text-13 text-ink-2">{formatMonthDayWeekday(h.date)}</span>
                <span className="flex-1 text-13 text-sub">{h.name}</span>
                <IconButton aria-label={`${h.name} 삭제`} onClick={() => trash.mutate({ id: h.id })}>
                  <Trash2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                </IconButton>
              </li>
            ))}
        </ul>
        <p className="text-12 text-sub">대체공휴일과 선거일도 넣어 두었어요. 학교 일정과 다르면 고쳐 주세요.</p>
      </div>
      {adding ? <HolidayDialog onClose={() => setAdding(false)} onSubmit={(date, name) => insert.mutate({ rows: [{ id: newId(), date, name }] })} /> : null}
    </Card>
  );
}

function HolidayDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (date: string, name: string) => void }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ date?: string; name?: string }>({});
  const submit = () => {
    const e: { date?: string; name?: string } = {};
    if (!date) e.date = "날짜를 골라 주세요";
    if (!name.trim()) e.name = "이름을 입력해 주세요";
    else if (name.trim().length > 30) e.name = "30자 이내로 써 주세요";
    setErrors(e);
    if (e.date || e.name) return;
    onSubmit(date, name.trim());
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="공휴일 추가"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <TextField label="이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      </div>
    </Dialog>
  );
}
