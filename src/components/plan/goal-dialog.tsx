"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { useSubjects } from "@/lib/data/subjects";
import { LEVEL_LABELS, parentLevel } from "@/lib/plan/goals";
import type { GoalLevel, GoalRow } from "@/lib/supabase/database.types";
import { fieldErrors } from "@/lib/validation/form";

export const goalSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력해 주세요").max(60, "60자 이내로 써 주세요"),
    subject_id: z.string().nullable(),
    level: z.enum(["long", "month", "week"]),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시작일을 골라 주세요"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "끝나는 날을 골라 주세요"),
    parent_id: z.string().nullable(),
    memo: z.string().max(500, "500자 이내로 써 주세요"),
  })
  .refine((v) => v.start_date <= v.end_date, { path: ["end_date"], message: "시작일보다 뒤여야 해요" });

export type GoalFormValues = z.infer<typeof goalSchema>;

/** 6.2 목표 항목: 제목, 과목, 기간 단위, 시작일과 끝나는 날, 상위 목표, 메모 */
export function GoalDialog({
  goal,
  goals,
  defaults,
  onClose,
  onSubmit,
  onDelete,
}: {
  goal: GoalRow | null;
  goals: readonly GoalRow[];
  defaults?: Partial<GoalFormValues>;
  onClose: () => void;
  onSubmit: (v: GoalFormValues) => void;
  onDelete?: () => void;
}) {
  const { data: subjects } = useSubjects();
  const [title, setTitle] = useState(goal?.title ?? defaults?.title ?? "");
  const [subjectId, setSubjectId] = useState(goal?.subject_id ?? defaults?.subject_id ?? "");
  const [level, setLevel] = useState<GoalLevel>(goal?.level ?? defaults?.level ?? "week");
  const [start, setStart] = useState(goal?.start_date ?? defaults?.start_date ?? "");
  const [end, setEnd] = useState(goal?.end_date ?? defaults?.end_date ?? "");
  const [parentId, setParentId] = useState(goal?.parent_id ?? defaults?.parent_id ?? "");
  const [memo, setMemo] = useState(goal?.memo ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const pl = parentLevel(level);
  const parents = goals.filter((g) => g.level === pl && g.id !== goal?.id);

  const submit = () => {
    const parsed = goalSchema.safeParse({
      title,
      subject_id: subjectId || null,
      level,
      start_date: start,
      end_date: end,
      parent_id: pl && parentId ? parentId : null,
      memo,
    });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    onSubmit(parsed.data);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={goal ? "목표 수정" : "목표 추가"}
      footer={
        <>
          {goal && onDelete ? (
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
        <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="기간 단위"
            value={level}
            onChange={(v) => setLevel(v as GoalLevel)}
            options={(["long", "month", "week"] as const).map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          />
          <SelectField
            label="과목"
            value={subjectId}
            onChange={setSubjectId}
            options={[{ value: "", label: "전체" }, ...(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="시작일" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errors.start_date} />
          <TextField label="끝나는 날" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={errors.end_date} />
        </div>
        {pl ? (
          <SelectField
            label="상위 목표 (선택)"
            value={parentId}
            onChange={setParentId}
            options={[{ value: "", label: "없음" }, ...parents.map((g) => ({ value: g.id, label: g.title }))]}
          />
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-12 text-sub">메모</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className="rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
          />
          {errors.memo ? <span className="text-12 text-urgent-ink">{errors.memo}</span> : null}
        </label>
      </div>
    </Dialog>
  );
}
