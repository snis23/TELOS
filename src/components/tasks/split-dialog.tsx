"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import type { TaskRow } from "@/lib/supabase/database.types";

/** 쪼개기: 2~3개의 작은 할 일로 나눈다 (5.7) */
export function SplitDialog({ task, onClose, onSplit }: { task: TaskRow | null; onClose: () => void; onSplit: (titles: string[]) => void }) {
  const [parts, setParts] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  if (!task) return null;
  const submit = () => {
    const titles = parts.map((p) => p.trim()).filter(Boolean);
    if (titles.length < 2) return setError("두 개 이상 써 주세요");
    if (titles.some((t) => t.length > 60)) return setError("60자 이내로 써 주세요");
    onSplit(titles);
    setParts(["", "", ""]);
    setError(null);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`"${task.title}" 쪼개기`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>쪼개기</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {parts.map((value, i) => (
          <TextField
            key={i}
            label={i === 2 ? "작은 할 일 3 (선택)" : `작은 할 일 ${i + 1}`}
            value={value}
            onChange={(e) => setParts(parts.map((p, j) => (j === i ? e.target.value : p)))}
            autoFocus={i === 0}
          />
        ))}
        {error ? <p className="text-12 text-urgent-ink">{error}</p> : null}
        <p className="text-12 text-sub">원래 할 일은 지우고, 새 할 일은 미룬 횟수 0에서 시작해요.</p>
      </div>
    </Dialog>
  );
}
