"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/data/crud";
import { reflectionKey, saveReflection, useReflection } from "@/lib/data/reflections";
import { useSaveErrorToast } from "@/lib/data/save-error";
import type { ReflectionRow } from "@/lib/supabase/database.types";

const FIELDS = [
  ["good", "잘한 것"],
  ["bad", "아쉬운 것"],
  ["tomorrow", "내일 할 것"],
] as const;
const MAX = 200;
const AUTOSAVE_MS = 800;

/**
 * 5.8 하루 회고: 하루에 하나. 컨디션 1~5점과 입력칸 3개.
 * 입력을 멈추고 0.8초 뒤 자동 저장하고 "저장됨"을 잠깐 보여 준다.
 */
function ReflectionForm({ date }: { date: string }) {
  const { data, isPending } = useReflection(date);
  if (isPending) return <div className="h-40" aria-busy="true" />;
  return <ReflectionFields key={`${date}-${data?.id ?? "new"}`} date={date} initial={data ?? null} />;
}

function ReflectionFields({ date, initial }: { date: string; initial: ReflectionRow | null }) {
  const queryClient = useQueryClient();
  const onSaveError = useSaveErrorToast();
  const [id] = useState(() => initial?.id ?? newId());
  const [values, setValues] = useState({
    good: initial?.good ?? "",
    bad: initial?.bad ?? "",
    tomorrow: initial?.tomorrow ?? "",
    condition: initial?.condition ?? null,
  });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saveReflection({ id, study_date: date, ...values });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        void queryClient.invalidateQueries({ queryKey: reflectionKey(date) });
      } catch (error) {
        onSaveError(error, () => setDirty((d) => !d));
      }
    }, AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, dirty]);

  const change = (patch: Partial<typeof values>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div role="radiogroup" aria-label="컨디션" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = values.condition === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`컨디션 ${n}점`}
                onClick={() => change({ condition: on ? null : n })}
                className={cn(
                  "hit num inline-flex size-condition items-center justify-center rounded-full text-12",
                  // 명세는 "흰 글자"지만 라이트에서 흰 글자는 대비 3:1 이라 4.5:1 규칙을 지키려고 진한 글자를 쓴다
                  on ? "bg-check font-semibold text-ink dark:text-btn-ink" : "bg-surface-2 text-ink-2",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        <span className={cn("text-11 text-sub transition-opacity", saved ? "opacity-100" : "opacity-0")} role="status">
          저장됨
        </span>
      </div>
      {FIELDS.map(([key, label]) => (
        <label key={key} className="flex flex-col gap-1.5">
          <span className="flex justify-between text-12 text-sub">
            {label}
            <span className="num text-11">
              {values[key].length}/{MAX}
            </span>
          </span>
          <textarea
            value={values[key]}
            maxLength={MAX}
            rows={2}
            onChange={(e) => change({ [key]: e.target.value } as Partial<typeof values>)}
            className="resize-none rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
          />
        </label>
      ))}
    </div>
  );
}

/** PC·패드는 카드로, 폰은 "하루 회고 쓰기" 버튼을 누르면 시트로 */
export function ReflectionCard({ date, asButton }: { date: string; asButton?: boolean }) {
  const [open, setOpen] = useState(false);
  if (asButton) {
    return (
      <>
        <Button variant="secondary" block onClick={() => setOpen(true)}>
          하루 회고 쓰기
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="하루 회고">
          <ReflectionForm date={date} />
        </Dialog>
      </>
    );
  }
  return (
    <section aria-label="하루 회고" className="card flex flex-col gap-4">
      <h2 className="text-14 font-semibold">하루 회고</h2>
      <ReflectionForm date={date} />
    </section>
  );
}
