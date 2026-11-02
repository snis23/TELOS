"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/tag";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { TimeSelect } from "@/components/ui/time-select";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useDayStartHour } from "@/lib/data/profile";
import { useDateTimetables, useSlots, useTimetables } from "@/lib/data/timetable";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { SlotCategory, TimetableSlotRow } from "@/lib/supabase/database.types";
import { CATEGORY_LABELS } from "@/lib/timetable/resolve";
import { clockToDayMin, dayMinToClock, formatDayMin } from "@/lib/timetable/time";
import { fieldErrors } from "@/lib/validation/form";

const slotSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력해 주세요").max(20, "20자 이내로 써 주세요"),
    category: z.enum(["class", "study", "meal", "life"]),
    start_min: z.number().int().min(0).max(1430),
    end_min: z.number().int().min(10).max(1440),
  })
  .refine((v) => v.end_min > v.start_min, { path: ["end_min"], message: "끝 시각이 시작보다 늦어야 해요" })
  .refine((v) => v.start_min % 10 === 0 && v.end_min % 10 === 0, { path: ["end_min"], message: "10분 단위로 골라 주세요" });

const CATEGORY_TONE = { study: "accent", class: "muted", meal: "normal", life: "normal" } as const;

/** 5.10 학교 시간표: 종류(평일, 주말·공휴일, 추가한 종류)별 항목 관리 + 날짜별 시간표 */
export function TimetableSettings() {
  const dayStartHour = useDayStartHour();
  const { data: timetables } = useTimetables();
  const { data: slots } = useSlots();
  const { data: dateTables } = useDateTimetables();
  const tt = useTableMutations("timetables");
  const slotMut = useTableMutations("timetable_slots");
  const dateMut = useTableMutations("date_timetables", { unique: "그 날짜에는 이미 정한 시간표가 있어요" });
  const [selected, setSelected] = useState<string | null>(null);
  const [slotDialog, setSlotDialog] = useState<TimetableSlotRow | "new" | null>(null);
  const [newType, setNewType] = useState(false);
  const [dateDialog, setDateDialog] = useState(false);

  const list = useMemo(() => timetables ?? [], [timetables]);
  const current = list.find((t) => t.id === selected) ?? list[0];
  const currentSlots = (slots ?? []).filter((s) => s.timetable_id === current?.id).sort((a, b) => a.start_min - b.start_min);

  return (
    <Card
      title="학교 시간표"
      actions={
        <Button variant="secondary" onClick={() => setNewType(true)}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          종류 추가
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="시간표 종류" className="flex flex-wrap gap-1.5">
          {list.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === current?.id}
              onClick={() => setSelected(t.id)}
              className={cn(
                "control-h rounded-full px-3.5 text-13",
                t.id === current?.id ? "bg-nav-on font-semibold text-accent-strong" : "bg-surface-2 text-ink-2",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>

        {current ? (
          <div role="tabpanel" className="flex flex-col">
            {currentSlots.length === 0 ? <EmptyState message="아직 항목이 없어요" /> : null}
            {currentSlots.map((s) => (
              <div key={s.id} className="flex min-h-10 items-center gap-2 border-b border-line py-1 last:border-b-0">
                <span className="num w-24 shrink-0 text-12 text-sub">
                  {formatDayMin(s.start_min, dayStartHour)}–{formatDayMin(s.end_min, dayStartHour)}
                </span>
                <span className="min-w-0 flex-1 truncate text-13 text-ink-2">{s.name}</span>
                <Badge tone={CATEGORY_TONE[s.category]}>{CATEGORY_LABELS[s.category]}</Badge>
                <IconButton aria-label={`${s.name} 수정`} onClick={() => setSlotDialog(s)}>
                  <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                </IconButton>
                <IconButton aria-label={`${s.name} 삭제`} onClick={() => slotMut.trash.mutate({ id: s.id })}>
                  <Trash2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                </IconButton>
              </div>
            ))}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setSlotDialog("new")}>
                <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
                항목 추가
              </Button>
              {current.default_for === "none" ? (
                <Button variant="danger" onClick={() => tt.trash.mutate({ id: current.id })}>
                  이 종류 삭제
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-13 font-semibold">특정 날짜만 다른 시간표</h3>
            <button type="button" className="text-12 text-accent" onClick={() => setDateDialog(true)}>
              날짜 추가
            </button>
          </div>
          {(dateTables ?? []).length === 0 ? (
            <p className="text-12 text-sub">예: 개교기념일, 시험 기간</p>
          ) : (
            (dateTables ?? []).map((d) => (
              <div key={d.id} className="flex min-h-10 items-center gap-2">
                <span className="text-13 text-ink-2">{formatMonthDayWeekday(d.date)}</span>
                <span className="flex-1 text-12 text-sub">{list.find((t) => t.id === d.timetable_id)?.name}</span>
                <IconButton aria-label="날짜 지정 삭제" onClick={() => dateMut.trash.mutate({ id: d.id })}>
                  <Trash2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                </IconButton>
              </div>
            ))
          )}
        </section>
      </div>

      {slotDialog && current ? (
        <SlotDialog
          slot={slotDialog === "new" ? null : slotDialog}
          dayStartHour={dayStartHour}
          onClose={() => setSlotDialog(null)}
          onSubmit={(v) => {
            if (slotDialog === "new") slotMut.insert.mutate({ rows: [{ id: newId(), timetable_id: current.id, ...v }] });
            else slotMut.update.mutate({ ids: [slotDialog.id], patch: v });
          }}
        />
      ) : null}
      {newType ? (
        <NameDialog
          title="시간표 종류 추가"
          label="이름 (예: 시험 기간, 방학)"
          onClose={() => setNewType(false)}
          onSubmit={(name) => {
            const id = newId();
            tt.insert.mutate({ rows: [{ id, name, default_for: "none", sort_order: list.length }] });
            setSelected(id);
          }}
        />
      ) : null}
      {dateDialog ? (
        <DateTimetableDialog
          timetables={list.map((t) => ({ value: t.id, label: t.name }))}
          onClose={() => setDateDialog(false)}
          onSubmit={(date, timetableId) => dateMut.insert.mutate({ rows: [{ id: newId(), date, timetable_id: timetableId }] })}
        />
      ) : null}
    </Card>
  );
}

function SlotDialog({
  slot,
  dayStartHour,
  onClose,
  onSubmit,
}: {
  slot: TimetableSlotRow | null;
  dayStartHour: number;
  onClose: () => void;
  onSubmit: (v: { name: string; category: SlotCategory; start_min: number; end_min: number }) => void;
}) {
  const [name, setName] = useState(slot?.name ?? "");
  const [category, setCategory] = useState<SlotCategory>(slot?.category ?? "study");
  const [start, setStart] = useState(slot?.start_min ?? 600);
  const [end, setEnd] = useState(slot?.end_min ?? 660);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const submit = () => {
    const parsed = slotSchema.safeParse({ name, category, start_min: start, end_min: end });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    onSubmit(parsed.data);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={slot ? "항목 수정" : "항목 추가"}
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
        <TextField label="이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
        <SelectField
          label="분류"
          value={category}
          onChange={(v) => setCategory(v as SlotCategory)}
          options={(Object.keys(CATEGORY_LABELS) as SlotCategory[]).map((k) => ({ value: k, label: CATEGORY_LABELS[k] }))}
        />
        <div className="flex flex-wrap gap-4">
          <TimeSelect
            label="시작"
            value={dayMinToClock(start, dayStartHour)}
            onChange={(c) => setStart(clockToDayMin(c, dayStartHour))}
            firstHour={dayStartHour}
          />
          <TimeSelect
            label="끝"
            value={dayMinToClock(end % 1440, dayStartHour)}
            onChange={(c) => setEnd(clockToDayMin(c, dayStartHour) || 1440)}
            firstHour={dayStartHour}
            error={errors.end_min}
          />
        </div>
      </div>
    </Dialog>
  );
}

export function NameDialog({
  title,
  label,
  initial = "",
  max = 20,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initial?: string;
  max?: number;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const submit = () => {
    const v = name.trim();
    if (!v) return setError("이름을 입력해 주세요");
    if (v.length > max) return setError(`${max}자 이내로 써 주세요`);
    onSubmit(v);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
        </>
      }
    >
      <TextField label={label} value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus />
    </Dialog>
  );
}

function DateTimetableDialog({
  timetables,
  onClose,
  onSubmit,
}: {
  timetables: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (date: string, timetableId: string) => void;
}) {
  const [date, setDate] = useState("");
  const [tt, setTt] = useState(timetables[0]?.value ?? "");
  const [error, setError] = useState<string | undefined>();
  return (
    <Dialog
      open
      onClose={onClose}
      title="특정 날짜 시간표"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={() => {
              if (!date) return setError("날짜를 골라 주세요");
              onSubmit(date, tt);
              onClose();
            }}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={error} />
        <SelectField label="시간표" value={tt} onChange={setTt} options={timetables} />
      </div>
    </Dialog>
  );
}
