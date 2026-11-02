"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { SubjectDot } from "@/components/ui/subject-dot";
import { TextField } from "@/components/ui/text-field";
import { newId } from "@/lib/data/crud";
import { examSubjectsKey, useExamSubjectMutations } from "@/lib/data/ddays";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { DdayRow, ExamSubjectRow, SubjectRow } from "@/lib/supabase/database.types";

export const RANGE_NOTE_MAX = 500;

/** 시험 과목 하나의 시험 날짜와 범위 메모 고치기 */
export function ExamSubjectDialog({
  exam,
  row,
  subject,
  onClose,
}: {
  exam: DdayRow;
  row: ExamSubjectRow | null;
  subject: SubjectRow | undefined;
  onClose: () => void;
}) {
  if (!row || !subject) return null;
  return <SubjectBody key={row.id} exam={exam} row={row} subject={subject} onClose={onClose} />;
}

function SubjectBody({ exam, row, subject, onClose }: { exam: DdayRow; row: ExamSubjectRow; subject: SubjectRow; onClose: () => void }) {
  const { update } = useExamSubjectMutations();
  const [date, setDate] = useState(row.exam_date ?? "");
  const [note, setNote] = useState(row.range_note ?? "");
  const tooLong = note.length > RANGE_NOTE_MAX;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${subject.name} 시험 범위`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={tooLong}
            onClick={() => {
              update.mutate({ ids: [row.id], patch: { exam_date: date || null, range_note: note.trim() || null } });
              onClose();
            }}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="이 과목 시험 날짜"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          hint={`비워 두면 시험 첫날(${formatMonthDayWeekday(exam.date)})로 봐요`}
        />
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-12 text-sub">
            시험 범위
            <span className="num text-11">
              {note.length}/{RANGE_NOTE_MAX}
            </span>
          </span>
          <textarea
            value={note}
            rows={4}
            placeholder="예: 교과서 p.120~210, 문제집 3~5단원, 프린트 1~6"
            onChange={(e) => setNote(e.target.value)}
            className="resize-none rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
          />
          {tooLong ? <span className="text-12 text-urgent-ink">{RANGE_NOTE_MAX}자 이내로 써 주세요</span> : null}
        </label>
      </div>
    </Dialog>
  );
}

/** 시험에 넣을 과목 고르기 (넣고 빼기). 뺀 과목의 로드맵 칸은 그대로 남는다 */
export function ExamSubjectPicker({
  open,
  exam,
  rows,
  candidates,
  onClose,
}: {
  open: boolean;
  exam: DdayRow;
  rows: readonly ExamSubjectRow[];
  candidates: readonly SubjectRow[];
  onClose: () => void;
}) {
  const { insert, trash } = useExamSubjectMutations();
  if (!open) return null;
  const inExam = new Map(rows.map((r) => [r.subject_id, r]));
  return (
    <Dialog open onClose={onClose} title="시험 과목">
      <ul className="flex flex-col">
        {candidates.map((s) => {
          const row = inExam.get(s.id);
          return (
            <li key={s.id} className="flex min-h-11 items-center gap-2 border-b border-line last:border-b-0">
              <Checkbox
                checked={Boolean(row)}
                label={`${s.name} 넣기`}
                onChange={(on) => {
                  if (on && !row) {
                    insert.mutate({
                      rows: [{ id: newId(), dday_id: exam.id, subject_id: s.id, sort_order: rows.length }],
                      appendTo: examSubjectsKey,
                    });
                  } else if (!on && row) trash.mutate({ id: row.id, silent: true });
                }}
              />
              <SubjectDot color={s.color_key} />
              <span className="text-14 text-ink-2">{s.name}</span>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

/** 과목 줄 오른쪽의 "12월 9일 · 범위" 단추 */
export function ExamSubjectMeta({
  exam,
  row,
  onEdit,
  name,
}: {
  exam: DdayRow;
  row: ExamSubjectRow | undefined;
  onEdit: () => void;
  name: string;
}) {
  return (
    <span className="flex min-w-0 max-w-full items-center gap-1 text-11 text-sub">
      <span className="shrink-0">시험 {formatMonthDayWeekday(row?.exam_date ?? exam.date)}</span>
      {row?.range_note ? (
        <span className="min-w-0 truncate" title={row.range_note}>
          · 범위 {row.range_note}
        </span>
      ) : (
        <span className="shrink-0">· 범위 없음</span>
      )}
      <IconButton aria-label={`${name} 시험 날짜와 범위`} onClick={onEdit}>
        <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
      </IconButton>
    </span>
  );
}
