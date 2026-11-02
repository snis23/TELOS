"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { z } from "zod";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { SelectField } from "@/components/ui/select";
import { SubjectDot } from "@/components/ui/subject-dot";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { subjectExamDate, useDdayMutations, useExamSubjectDates, useRangeItems } from "@/lib/data/ddays";
import { useSubjects } from "@/lib/data/subjects";
import { useSlots } from "@/lib/data/timetable";
import { WEEKDAY_SHORT, formatMonthDayWeekday } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { UNIT_LABELS, doneAmount, formatRange, subjectProgress, todayPortion, totalAmount } from "@/lib/exam/range";
import type { DdayRow, RangeItemRow, RangeUnit, SubjectRow } from "@/lib/supabase/database.types";
import { fieldErrors } from "@/lib/validation/form";

const itemSchema = z
  .object({
    subject_id: z.string().min(1, "과목을 골라 주세요"),
    name: z.string().trim().min(1, "이름을 입력해 주세요").max(40, "40자 이내로 써 주세요"),
    unit_label: z.enum(["page", "unit", "chapter", "problem"]),
    start_no: z.number({ error: "숫자로 입력해 주세요" }).int().min(0, "0 이상이어야 해요").max(100000),
    end_no: z.number({ error: "숫자로 입력해 주세요" }).int().min(0).max(100000, "너무 커요"),
    done_amount: z.number({ error: "숫자로 입력해 주세요" }).int().min(0, "0 이상이어야 해요"),
    default_slot_name: z.string().nullable(),
  })
  .refine((v) => v.start_no <= v.end_no, { path: ["end_no"], message: "시작 번호보다 크거나 같아야 해요" });

type ItemValues = z.infer<typeof itemSchema>;

/** 6.5 범위 분배 탭 */
export function RangeTab({ exam, today }: { exam: DdayRow | null; today: string }) {
  const { data: subjects } = useSubjects();
  const { data: items } = useRangeItems();
  const { data: dates } = useExamSubjectDates();
  const ddayMut = useDdayMutations();
  const itemMut = useTableMutations("range_items");
  const dateMut = useTableMutations("exam_subject_dates");
  const [dialog, setDialog] = useState<{ item: RangeItemRow | null; subjectId?: string } | null>(null);

  if (!exam) return <EmptyState message="시험을 먼저 추가해 주세요" />;
  const examItems = (items ?? []).filter((i) => i.dday_id === exam.id);
  const subjectIds = [...new Set(examItems.map((i) => i.subject_id))];
  const subjectRows = (subjects ?? []).filter((s) => subjectIds.includes(s.id));

  const setSubjectDate = (subjectId: string, date: string) => {
    const existing = (dates ?? []).find((d) => d.dday_id === exam.id && d.subject_id === subjectId);
    if (!date) {
      if (existing) dateMut.trash.mutate({ id: existing.id, silent: true });
    } else if (existing) dateMut.update.mutate({ ids: [existing.id], patch: { date } });
    else dateMut.insert.mutate({ rows: [{ id: newId(), dday_id: exam.id, subject_id: subjectId, date }] });
  };

  const save = (v: ItemValues) => {
    const patch = { ...v, default_slot_name: v.default_slot_name || null };
    if (dialog?.item) itemMut.update.mutate({ ids: [dialog.item.id], patch });
    else itemMut.insert.mutate({ rows: [{ id: newId(), dday_id: exam.id, sort_order: examItems.length, ...patch }] });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4" aria-label="시험 설정">
        <div className="flex flex-wrap items-end gap-4">
          <SelectField
            label="총복습 기간"
            value={String(exam.review_days)}
            onChange={(v) => ddayMut.update.mutate({ ids: [exam.id], patch: { review_days: Number(v) } })}
            options={Array.from({ length: 15 }, (_, n) => ({ value: String(n), label: `${n}일` }))}
            className="w-32"
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-12 text-sub">공부 안 하는 요일</legend>
            <div className="flex flex-wrap gap-1">
              {WEEKDAY_SHORT.map((label, i) => {
                const day = i + 1;
                const on = exam.off_weekdays.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      ddayMut.update.mutate({
                        ids: [exam.id],
                        patch: { off_weekdays: on ? exam.off_weekdays.filter((d) => d !== day) : [...exam.off_weekdays, day].sort() },
                      })
                    }
                    className={cn(
                      "hit inline-flex size-9 items-center justify-center rounded-full text-13",
                      on ? "bg-urgent-bg font-semibold text-urgent-ink" : "bg-surface-2 text-ink-2",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => setDialog({ item: null })}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          범위 추가
        </Button>
      </div>

      {subjectRows.length === 0 ? (
        <div className="card">
          <EmptyState message="아직 시험 범위가 없어요" />
        </div>
      ) : (
        <div className="grid gap-6 land:grid-cols-2">
          {subjectRows.map((s) => (
            <SubjectRangeCard
              key={s.id}
              subject={s}
              exam={exam}
              today={today}
              items={examItems.filter((i) => i.subject_id === s.id)}
              examDate={subjectExamDate(exam, s.id, dates ?? [])}
              hasOwnDate={(dates ?? []).some((d) => d.dday_id === exam.id && d.subject_id === s.id)}
              onDate={(d) => setSubjectDate(s.id, d)}
              onEdit={(item) => setDialog({ item })}
              onAdd={() => setDialog({ item: null, subjectId: s.id })}
            />
          ))}
        </div>
      )}

      {dialog ? (
        <RangeItemDialog
          item={dialog.item}
          subjects={subjects ?? []}
          defaultSubjectId={dialog.subjectId}
          onClose={() => setDialog(null)}
          onSubmit={save}
          onDelete={
            dialog.item
              ? () => {
                  itemMut.trash.mutate({ id: (dialog.item as RangeItemRow).id });
                  setDialog(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function SubjectRangeCard({
  subject,
  exam,
  today,
  items,
  examDate,
  hasOwnDate,
  onDate,
  onEdit,
  onAdd,
}: {
  subject: SubjectRow;
  exam: DdayRow;
  today: string;
  items: RangeItemRow[];
  examDate: string;
  hasOwnDate: boolean;
  onDate: (date: string) => void;
  onEdit: (item: RangeItemRow) => void;
  onAdd: () => void;
}) {
  const p = subjectProgress(items) ?? 0;
  const summary = items.map((i) => `${i.name} ${formatRange(i.unit_label, i.start_no, i.end_no)}`).join(" · ");
  return (
    <section className="card flex flex-col gap-3" aria-label={`${subject.name} 범위`} data-subject={subject.color_key}>
      <header className="flex items-center gap-2">
        <SubjectDot color={subject.color_key} />
        <h3 className="flex-1 text-14 font-semibold">{subject.name}</h3>
        <span className="num text-14 font-medium">{Math.round(p * 100)}%</span>
      </header>
      <p className="text-12 text-sub">{summary}</p>
      <ProgressBar value={p} label={`${subject.name} 범위 진행률`} tone="subject" />
      <ul className="flex flex-col gap-1">
        {items.map((i) => {
          const portion = todayPortion(i, { today, examDate, reviewDays: exam.review_days, offWeekdays: exam.off_weekdays });
          const text =
            portion.kind === "portion"
              ? `오늘 · ${i.name} ${formatRange(i.unit_label, portion.from, portion.to)}`
              : portion.kind === "review"
                ? "총복습 기간이에요"
                : portion.kind === "done"
                  ? `${i.name} 다 끝냈어요`
                  : "오늘은 쉬는 요일이에요";
          return (
            <li key={i.id} className="flex min-h-9 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-13 text-ink-2">{text}</span>
                <span className="num text-11 text-sub">
                  {i.name} {doneAmount(i)}/{totalAmount(i)}
                  {UNIT_LABELS[i.unit_label]}
                </span>
              </span>
              <IconButton aria-label={`${i.name} 수정`} onClick={() => onEdit(i)}>
                <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
        <TextField
          label={hasOwnDate ? "이 과목 시험일" : `이 과목 시험일 (기본 ${formatMonthDayWeekday(exam.date)})`}
          type="date"
          value={hasOwnDate ? examDate : ""}
          onChange={(e) => onDate(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button variant="secondary" onClick={onAdd}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          항목
        </Button>
      </div>
    </section>
  );
}

function RangeItemDialog({
  item,
  subjects,
  defaultSubjectId,
  onClose,
  onSubmit,
  onDelete,
}: {
  item: RangeItemRow | null;
  subjects: readonly SubjectRow[];
  defaultSubjectId?: string;
  onClose: () => void;
  onSubmit: (v: ItemValues) => void;
  onDelete?: () => void;
}) {
  const { data: slots } = useSlots();
  const [subjectId, setSubjectId] = useState(item?.subject_id ?? defaultSubjectId ?? subjects[0]?.id ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState<RangeUnit>(item?.unit_label ?? "page");
  const [start, setStart] = useState(item ? String(item.start_no) : "");
  const [end, setEnd] = useState(item ? String(item.end_no) : "");
  const [done, setDone] = useState(item ? String(item.done_amount) : "0");
  const [slotName, setSlotName] = useState(item?.default_slot_name ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const slotNames = [...new Set((slots ?? []).filter((s) => s.category === "study").map((s) => s.name))];
  const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

  const submit = () => {
    const parsed = itemSchema.safeParse({
      subject_id: subjectId,
      name,
      unit_label: unit,
      start_no: num(start),
      end_no: num(end),
      done_amount: num(done),
      default_slot_name: slotName || null,
    });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    onSubmit(parsed.data);
    onClose();
  };
  const digits = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value.replace(/[^0-9]/g, ""));

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? "범위 수정" : "범위 추가"}
      footer={
        <>
          {item && onDelete ? (
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
          <SelectField label="과목" value={subjectId} onChange={setSubjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} error={errors.subject_id} />
          <SelectField
            label="단위"
            value={unit}
            onChange={(v) => setUnit(v as RangeUnit)}
            options={(Object.keys(UNIT_LABELS) as RangeUnit[]).map((k) => ({ value: k, label: UNIT_LABELS[k] }))}
          />
        </div>
        <TextField label="이름 (교과서, 문제집, 프린트 등)" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <div className="grid grid-cols-3 gap-3">
          <TextField label="시작 번호" inputMode="numeric" value={start} onChange={digits(setStart)} error={errors.start_no} />
          <TextField label="끝 번호" inputMode="numeric" value={end} onChange={digits(setEnd)} error={errors.end_no} />
          <TextField label="끝낸 양" inputMode="numeric" value={done} onChange={digits(setDone)} error={errors.done_amount} />
        </div>
        <SelectField
          label="기본 차시 (선택)"
          value={slotName}
          onChange={setSlotName}
          options={[{ value: "", label: "없음" }, ...slotNames.map((n) => ({ value: n, label: n }))]}
        />
      </div>
    </Dialog>
  );
}
