"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { TimeSelect } from "@/components/ui/time-select";
import { cn } from "@/lib/cn";
import { useDayStartHour } from "@/lib/data/profile";
import { useSubjects } from "@/lib/data/subjects";
import { useDayTimetable } from "@/lib/data/timetable";
import { WEEKDAY_SHORT, isoWeekday } from "@/lib/date/days";
import type { RecurrenceRule, TaskRow } from "@/lib/supabase/database.types";
import { clockToDayMin, dayMinToClock, formatDayMin } from "@/lib/timetable/time";
import { fieldErrors } from "@/lib/validation/form";

/** 5.6 할 일 추가와 수정 */

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력해 주세요").max(80, "80자 이내로 써 주세요"),
    subject_id: z.string().nullable(),
    est_minutes: z
      .number({ error: "숫자로 입력해 주세요" })
      .int("정수로 입력해 주세요")
      .min(5, "5분 이상이어야 해요")
      .max(600, "600분 이하여야 해요")
      .nullable(),
    study_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 골라 주세요"),
    repeat: z.enum(["none", "daily", "weekdays", "biweekly"]),
    days: z.array(z.number().int().min(1).max(7)),
    end_date: z.string().nullable(),
    block: z.boolean(),
    start_min: z.number().int().min(0).max(1430),
    end_min: z.number().int().min(10).max(1440),
    slot_id: z.string().nullable(),
  })
  .refine((v) => v.repeat === "none" || v.repeat === "daily" || v.days.length > 0, {
    path: ["days"],
    message: "요일을 하나 이상 골라 주세요",
  })
  .refine((v) => !v.end_date || v.end_date >= v.study_date, { path: ["end_date"], message: "시작 날짜 뒤로 골라 주세요" })
  .refine((v) => !v.block || v.end_min > v.start_min, { path: ["end_min"], message: "끝 시각이 시작보다 늦어야 해요" });

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function ruleFromForm(v: Pick<TaskFormValues, "repeat" | "days">): RecurrenceRule | null {
  if (v.repeat === "none") return null;
  if (v.repeat === "daily") return { type: "daily" };
  return { type: v.repeat, days: [...v.days].sort((a, b) => a - b) };
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** 고칠 할 일. 없으면 새로 만든다 */
  task?: TaskRow | null;
  /** 새로 만들 때 미리 채울 값 */
  defaults?: Partial<Pick<TaskRow, "study_date" | "start_min" | "end_min" | "slot_id" | "subject_id">>;
  /** 반복 할 일을 고칠 때는 반복 설정을 바꾸지 않는다 ("이번만"/"앞으로 모두"는 따로 묻는다) */
  onSubmit: (values: TaskFormValues) => void;
  onDelete?: () => void;
};

export function TaskDialog(props: Props) {
  if (!props.open) return null;
  return <TaskDialogBody key={props.task?.id ?? "new"} {...props} />;
}

function TaskDialogBody({ open, onClose, task, defaults, onSubmit, onDelete }: Props) {
  const { data: subjects } = useSubjects();
  const dayStartHour = useDayStartHour();
  const [title, setTitle] = useState(task?.title ?? "");
  const [subjectId, setSubjectId] = useState<string>(task?.subject_id ?? defaults?.subject_id ?? "");
  const [est, setEst] = useState(task?.est_minutes ? String(task.est_minutes) : "");
  const [date, setDate] = useState(task?.study_date ?? defaults?.study_date ?? "");
  const [repeat, setRepeat] = useState<TaskFormValues["repeat"]>("none");
  const [days, setDays] = useState<number[]>(() => (date ? [isoWeekday(date)] : []));
  const [endDate, setEndDate] = useState("");
  const startDefault = task?.start_min ?? defaults?.start_min ?? null;
  const [block, setBlock] = useState(startDefault !== null);
  const [startMin, setStartMin] = useState(startDefault ?? 14 * 60 - dayStartHour * 60);
  const [endMin, setEndMin] = useState(task?.end_min ?? defaults?.end_min ?? (startDefault ?? 14 * 60 - dayStartHour * 60) + 60);
  const [slotId, setSlotId] = useState<string>(task?.slot_id ?? defaults?.slot_id ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const { slots } = useDayTimetable(date);
  const isRecurring = task?.source === "recurrence";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const slot = slots.find((s) => s.id === slotId);
    const parsed = taskFormSchema.safeParse({
      title,
      subject_id: subjectId || null,
      est_minutes: est.trim() === "" ? null : Number(est),
      study_date: date,
      repeat: task ? "none" : repeat,
      days,
      end_date: endDate || null,
      block: Boolean(slot) || block,
      start_min: slot ? slot.start_min : startMin,
      end_min: slot ? slot.end_min : endMin,
      slot_id: slot?.id ?? null,
    });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    onSubmit(parsed.data);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? "할 일 수정" : "할 일 추가"}
      footer={
        <>
          {task && onDelete ? (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              삭제
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="task-form">
            저장
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="과목"
            value={subjectId}
            onChange={setSubjectId}
            options={[{ value: "", label: "없음" }, ...(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          />
          <TextField
            label="예상 시간 (분)"
            inputMode="numeric"
            value={est}
            onChange={(e) => setEst(e.target.value.replace(/[^0-9]/g, ""))}
            error={errors.est_minutes}
          />
        </div>
        <TextField label="날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.study_date} />

        {!task ? (
          <div className="flex flex-col gap-2">
            <SelectField
              label="반복"
              value={repeat}
              onChange={(v) => setRepeat(v as TaskFormValues["repeat"])}
              options={[
                { value: "none", label: "없음" },
                { value: "daily", label: "매일" },
                { value: "weekdays", label: "요일 선택" },
                { value: "biweekly", label: "격주" },
              ]}
            />
            {repeat === "weekdays" || repeat === "biweekly" ? (
              <div role="group" aria-label="요일" className="flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, i) => {
                  const day = i + 1;
                  const on = days.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDays(on ? days.filter((d) => d !== day) : [...days, day])}
                      className={cn(
                        "hit inline-flex size-9 items-center justify-center rounded-full text-13",
                        on ? "bg-nav-on font-semibold text-accent-strong" : "bg-surface-2 text-ink-2",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {errors.days ? <p className="text-12 text-urgent-ink">{errors.days}</p> : null}
            {repeat !== "none" ? (
              <TextField
                label="반복 끝나는 날 (선택)"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                error={errors.end_date}
              />
            ) : null}
          </div>
        ) : isRecurring ? (
          <p className="text-12 text-sub">반복 할 일이에요. 저장할 때 이번만 바꿀지, 앞으로 모두 바꿀지 물어봐요.</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <SelectField
            label={repeat === "none" ? "시간표 칸 (선택)" : "기본 차시 (선택)"}
            value={slotId}
            onChange={(v) => {
              setSlotId(v);
              if (v) setBlock(true);
            }}
            options={[
              { value: "", label: "없음" },
              ...slots.map((s) => ({
                value: s.id,
                label: `${s.name} ${formatDayMin(s.start_min, dayStartHour)}–${formatDayMin(s.end_min, dayStartHour)}`,
              })),
            ]}
          />
          {!slotId ? (
            <label className="flex items-center gap-2 text-13 text-ink-2">
              <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="size-4 accent-check" />
              시간 정하기
            </label>
          ) : null}
          {!slotId && block ? (
            <div className="flex flex-wrap gap-4">
              <TimeSelect
                label="시작"
                value={dayMinToClock(startMin, dayStartHour)}
                onChange={(c) => setStartMin(clockToDayMin(c, dayStartHour))}
                firstHour={dayStartHour}
              />
              <TimeSelect
                label="끝"
                value={dayMinToClock(endMin === 1440 ? 1439 : endMin, dayStartHour)}
                onChange={(c) => setEndMin(clockToDayMin(c, dayStartHour) || 1440)}
                firstHour={dayStartHour}
                error={errors.end_min}
              />
            </div>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
