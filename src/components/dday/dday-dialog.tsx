"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { useSubjects } from "@/lib/data/subjects";
import type { DdayRow, DdayType, ExamKind, PerfKind, PerfStatus } from "@/lib/supabase/database.types";
import { fieldErrors } from "@/lib/validation/form";

export const DDAY_TYPE_LABELS: Record<DdayType, string> = { exam: "시험", performance: "수행평가", etc: "기타" };
export const PERF_KIND_LABELS: Record<PerfKind, string> = {
  report: "보고서",
  presentation: "발표",
  experiment: "실험",
  writing: "글쓰기",
  debate: "토론",
  etc: "기타",
};
export const EXAM_KIND_LABELS: Record<ExamKind, string> = { school: "내신 시험", mock: "모의고사", other: "기타 시험" };
export const EXAM_KIND_HINTS: Record<ExamKind, string> = {
  school: "이번 학기 내신 과목이 들어가요",
  mock: "모의고사 과목(국어·수학·영어·한국사·통합과학·통합사회)이 들어가요",
  other: "모든 과목 중에서 골라요",
};
export const PERF_STATUS_LABELS: Record<PerfStatus, string> = { todo: "시작 전", doing: "준비 중", done: "완료" };

export const ddaySchema = z
  .object({
    type: z.enum(["exam", "performance", "etc"]),
    title: z.string().trim().min(1, "이름을 입력해 주세요").max(60, "60자 이내로 써 주세요"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라 주세요"),
    subject_id: z.string().nullable(),
    perf_kind: z.enum(["report", "presentation", "experiment", "writing", "debate", "etc"]).nullable(),
    status: z.enum(["todo", "doing", "done"]),
    prep_percent: z.number().int().min(0, "0~100 사이로 써 주세요").max(100, "0~100 사이로 써 주세요").nullable(),
    memo: z.string().max(500, "500자 이내로 써 주세요"),
    exam_kind: z.enum(["school", "mock", "other"]).nullable(),
  })
  .refine((v) => v.type !== "performance" || v.subject_id, { path: ["subject_id"], message: "과목을 골라 주세요" });

export type DdayFormValues = z.infer<typeof ddaySchema>;

/** D-day 추가·수정 (6.5 일정 탭, 수행평가) */
export function DdayDialog({
  open,
  dday,
  defaultType = "exam",
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  dday?: DdayRow | null;
  defaultType?: DdayType;
  onClose: () => void;
  onSubmit: (values: DdayFormValues) => void;
  onDelete?: () => void;
}) {
  if (!open) return null;
  return <Body key={dday?.id ?? "new"} {...{ dday, defaultType, onClose, onSubmit, onDelete }} />;
}

function Body({
  dday,
  defaultType,
  onClose,
  onSubmit,
  onDelete,
}: {
  dday?: DdayRow | null;
  defaultType: DdayType;
  onClose: () => void;
  onSubmit: (values: DdayFormValues) => void;
  onDelete?: () => void;
}) {
  const { data: subjects } = useSubjects();
  const [type, setType] = useState<DdayType>(dday?.type ?? defaultType);
  const [title, setTitle] = useState(dday?.title ?? "");
  const [date, setDate] = useState(dday?.date ?? "");
  const [subjectId, setSubjectId] = useState(dday?.subject_id ?? "");
  const [perfKind, setPerfKind] = useState<PerfKind>(dday?.perf_kind ?? "report");
  const [status, setStatus] = useState<PerfStatus>(dday?.status ?? "todo");
  const [prep, setPrep] = useState(dday?.prep_percent != null ? String(dday.prep_percent) : "");
  const [memo, setMemo] = useState(dday?.memo ?? "");
  const [examKind, setExamKind] = useState<ExamKind>(dday?.exam_kind ?? "school");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ddaySchema.safeParse({
      type,
      title,
      date,
      subject_id: subjectId || null,
      perf_kind: type === "performance" ? perfKind : null,
      status: type === "performance" ? status : "todo",
      prep_percent: type === "performance" && status === "doing" && prep !== "" ? Number(prep) : null,
      memo,
      exam_kind: type === "exam" ? examKind : null,
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
      title={dday ? "일정 수정" : "일정 추가"}
      footer={
        <>
          {dday && onDelete ? (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              삭제
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="dday-form">
            저장
          </Button>
        </>
      }
    >
      <form id="dday-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <SelectField
          label="종류"
          value={type}
          onChange={(v) => setType(v as DdayType)}
          options={(Object.keys(DDAY_TYPE_LABELS) as DdayType[]).map((k) => ({ value: k, label: DDAY_TYPE_LABELS[k] }))}
        />
        {type === "exam" ? (
          <SelectField
            label="시험 종류"
            value={examKind}
            onChange={(v) => setExamKind(v as ExamKind)}
            options={(Object.keys(EXAM_KIND_LABELS) as ExamKind[]).map((k) => ({ value: k, label: EXAM_KIND_LABELS[k] }))}
          />
        ) : null}
        <TextField label={type === "performance" ? "제목" : "이름"} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={type === "exam" ? "시험 첫날" : type === "performance" ? "마감일" : "날짜"}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
          />
          <SelectField
            label={type === "performance" ? "과목" : "과목 (선택)"}
            value={subjectId}
            onChange={setSubjectId}
            error={errors.subject_id}
            options={[{ value: "", label: "없음" }, ...(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          />
        </div>
        {type === "performance" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="유형"
                value={perfKind}
                onChange={(v) => setPerfKind(v as PerfKind)}
                options={(Object.keys(PERF_KIND_LABELS) as PerfKind[]).map((k) => ({ value: k, label: PERF_KIND_LABELS[k] }))}
              />
              <SelectField
                label="상태"
                value={status}
                onChange={(v) => setStatus(v as PerfStatus)}
                options={(Object.keys(PERF_STATUS_LABELS) as PerfStatus[]).map((k) => ({ value: k, label: PERF_STATUS_LABELS[k] }))}
              />
            </div>
            {status === "doing" ? (
              <TextField
                label="준비율 (%)"
                inputMode="numeric"
                value={prep}
                onChange={(e) => setPrep(e.target.value.replace(/[^0-9]/g, ""))}
                error={errors.prep_percent}
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
          </>
        ) : null}
      </form>
    </Dialog>
  );
}
