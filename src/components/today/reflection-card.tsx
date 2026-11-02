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

const MAX = 500;
const AUTOSAVE_MS = 800;

/**
 * 5.8 하루 코멘트: 하루에 하나, 입력칸 하나.
 * 입력을 멈추고 0.8초 뒤 자동 저장하고 "저장됨"을 잠깐 보여 준다.
 */
function CommentForm({ date }: { date: string }) {
  const { data, isPending } = useReflection(date);
  if (isPending) return <div className="h-24" aria-busy="true" />;
  return <CommentField key={`${date}-${data?.id ?? "new"}`} date={date} initial={data ?? null} />;
}

function CommentField({ date, initial }: { date: string; initial: ReflectionRow | null }) {
  const queryClient = useQueryClient();
  const onSaveError = useSaveErrorToast();
  const [id] = useState(() => initial?.id ?? newId());
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saveReflection({ id, study_date: date, comment });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        void queryClient.invalidateQueries({ queryKey: reflectionKey(date) });
        void queryClient.invalidateQueries({ queryKey: ["reflections", "all"] });
      } catch (error) {
        onSaveError(error, () => setDirty((d) => !d));
      }
    }, AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, dirty]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-12 text-sub">
        오늘 한 줄
        <span className="flex gap-2">
          <span className={cn("transition-opacity", saved ? "opacity-100" : "opacity-0")} role="status">
            저장됨
          </span>
          <span className="num text-11">
            {comment.length}/{MAX}
          </span>
        </span>
      </span>
      <textarea
        value={comment}
        maxLength={MAX}
        rows={3}
        placeholder="오늘 공부는 어땠나요? 잘한 것, 아쉬운 것, 내일 할 것을 자유롭게 적어요"
        onChange={(e) => {
          setComment(e.target.value);
          setDirty(true);
        }}
        className="resize-none rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
      />
    </label>
  );
}

/** PC·패드는 카드로, 폰은 "하루 코멘트 쓰기" 버튼을 누르면 시트로 */
export function ReflectionCard({ date, asButton }: { date: string; asButton?: boolean }) {
  const [open, setOpen] = useState(false);
  if (asButton) {
    return (
      <>
        <Button variant="secondary" block onClick={() => setOpen(true)}>
          하루 코멘트 쓰기
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="하루 코멘트">
          <CommentForm date={date} />
        </Dialog>
      </>
    );
  }
  return (
    <section aria-label="하루 코멘트" className="card flex flex-col gap-4">
      <h2 className="text-14 font-semibold">하루 코멘트</h2>
      <CommentForm date={date} />
    </section>
  );
}
