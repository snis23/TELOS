"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { defaultRoundName } from "@/lib/learn/notes";
import type { MockRoundRow } from "@/lib/supabase/database.types";

/** 모의고사 회차 (8.3): 연도, 월, 이름(기본 "2026년 10월 모의고사") */
export function RoundDialog({
  round,
  onClose,
  onSubmit,
  onDelete,
}: {
  round?: MockRoundRow | null;
  onClose: () => void;
  onSubmit: (v: { year: number; month: number; name: string }) => void;
  onDelete?: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(round?.year ?? now.getFullYear());
  const [month, setMonth] = useState(round?.month ?? now.getMonth() + 1);
  const [name, setName] = useState(round?.name ?? "");
  const [touched, setTouched] = useState(Boolean(round));
  const [error, setError] = useState<string | undefined>();
  const shown = touched ? name : defaultRoundName(year, month);
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  const submit = () => {
    const v = shown.trim();
    if (!v) return setError("이름을 입력해 주세요");
    if (v.length > 40) return setError("40자 이내로 써 주세요");
    onSubmit({ year, month, name: v });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={round ? "회차 수정" : "새 회차"}
      footer={
        <>
          {round && onDelete ? (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              삭제
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="연도" value={String(year)} onChange={(v) => setYear(Number(v))} options={years.map((y) => ({ value: String(y), label: `${y}년` }))} />
          <SelectField
            label="월"
            value={String(month)}
            onChange={(v) => setMonth(Number(v))}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` }))}
          />
        </div>
        <TextField
          label="이름"
          value={shown}
          onChange={(e) => {
            setTouched(true);
            setName(e.target.value);
          }}
          error={error}
        />
      </div>
    </Dialog>
  );
}
