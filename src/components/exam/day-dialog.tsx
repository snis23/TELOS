"use client";

import { useState } from "react";
import { ListPlus, Trash2 } from "lucide-react";
import { RoadmapPicker } from "@/components/roadmap/roadmap-picker";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { SubjectTag } from "@/components/ui/tag";
import { TextField } from "@/components/ui/text-field";
import { newId } from "@/lib/data/crud";
import { roadmapKey, useRoadmapActions } from "@/lib/data/ddays";
import { useToday } from "@/lib/data/today";
import { formatMonthDayWeekday } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { roundLabel } from "@/lib/exam/roadmap";
import type { RoadmapItemRow, SubjectRow } from "@/lib/supabase/database.types";

export const ROADMAP_CONTENT_MAX = 80;
const ROUNDS = [1, 2, 3, 4, 5];

/**
 * 로드맵 달력의 하루: 그날 계획(과목 + 무슨 공부 + 회독)을 적고, 체크하고, 오늘 할 일로 가져온다.
 */
export function DayDialog({
  date,
  examId,
  items,
  subjects,
  subjectMap,
  linkedIds,
  onClose,
}: {
  date: string | null;
  examId: string;
  items: readonly RoadmapItemRow[];
  /** 이 시험의 과목 (입력할 때 고르는 목록) */
  subjects: readonly SubjectRow[];
  subjectMap: ReadonlyMap<string, SubjectRow>;
  /** 이미 할 일로 넣은 로드맵 칸 */
  linkedIds: ReadonlySet<string>;
  onClose: () => void;
}) {
  if (!date) return null;
  return (
    <DayBody
      key={date}
      date={date}
      examId={examId}
      items={items}
      subjects={subjects}
      subjectMap={subjectMap}
      linkedIds={linkedIds}
      onClose={onClose}
    />
  );
}

function DayBody({
  date,
  examId,
  items,
  subjects,
  subjectMap,
  linkedIds,
  onClose,
}: {
  date: string;
  examId: string;
  items: readonly RoadmapItemRow[];
  subjects: readonly SubjectRow[];
  subjectMap: ReadonlyMap<string, SubjectRow>;
  linkedIds: ReadonlySet<string>;
  onClose: () => void;
}) {
  const today = useToday();
  const { insert, update, trash, toggle } = useRoadmapActions();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [content, setContent] = useState("");
  const [round, setRound] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!subjectId) return setError("과목을 골라 주세요");
    if (!text) return setError("무슨 공부를 할지 써 주세요");
    if (text.length > ROADMAP_CONTENT_MAX) return setError(`${ROADMAP_CONTENT_MAX}자 이내로 써 주세요`);
    insert.mutate({
      rows: [
        {
          id: newId(),
          dday_id: examId,
          subject_id: subjectId,
          study_date: date,
          content: text,
          round: round ? Number(round) : null,
          sort_order: items.length,
        },
      ],
      appendTo: roadmapKey,
    });
    setContent("");
    setError(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    const text = editing.content.trim();
    if (text && text.length <= ROADMAP_CONTENT_MAX) update.mutate({ ids: [editing.id], patch: { content: text } });
    setEditing(null);
  };

  return (
    <>
      <Dialog open onClose={onClose} title={`${formatMonthDayWeekday(date)} 계획`}>
        <div className="flex flex-col gap-5">
          {items.length === 0 ? (
            <EmptyState message="이날 계획이 없어요. 아래에서 과목과 공부할 내용을 적어 주세요." />
          ) : (
            <ul className="flex flex-col" aria-label="이날 계획">
              {items.map((it) => {
                const s = subjectMap.get(it.subject_id);
                const linked = linkedIds.has(it.id);
                return (
                  <li key={it.id} className="flex min-h-11 items-center gap-2 border-b border-line py-1 last:border-b-0">
                    <Checkbox checked={Boolean(it.done_at)} onChange={(v) => toggle(it, v)} label={`${it.content} 끝냄`} />
                    {s ? <SubjectTag name={s.name} color={s.color_key} /> : null}
                    {editing?.id === it.id ? (
                      <input
                        aria-label="계획 고치기"
                        autoFocus
                        value={editing.content}
                        maxLength={ROADMAP_CONTENT_MAX}
                        onChange={(e) => setEditing({ id: it.id, content: e.target.value })}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                        }}
                        className="control-h min-w-0 flex-1 rounded-input bg-surface-2 px-2 text-13 text-ink outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        className={`min-w-0 flex-1 truncate text-left text-13 ${it.done_at ? "text-sub line-through" : "text-ink"}`}
                        onClick={() => setEditing({ id: it.id, content: it.content })}
                      >
                        {it.content}
                      </button>
                    )}
                    {it.round ? <span className="text-11 text-accent-strong">{roundLabel(it.round)}</span> : null}
                    {linked ? (
                      <span className="text-11 text-sub">할 일에 있음</span>
                    ) : !it.done_at ? (
                      <IconButton aria-label={`${it.content} 할 일로 가져오기`} onClick={() => setPickFor(it.id)}>
                        <ListPlus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                      </IconButton>
                    ) : null}
                    <IconButton aria-label={`${it.content} 삭제`} onClick={() => trash.mutate({ id: it.id })}>
                      <Trash2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={add} noValidate className="flex flex-col gap-3 rounded-input bg-surface-2/60 p-3" aria-label="계획 추가">
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="과목"
                value={subjectId}
                onChange={setSubjectId}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />
              <SelectField
                label="회독 (선택)"
                value={round}
                onChange={setRound}
                options={[{ value: "", label: "없음" }, ...ROUNDS.map((r) => ({ value: String(r), label: roundLabel(r) }))]}
              />
            </div>
            <TextField
              label="무슨 공부"
              placeholder="예: 문제집 p.30~50, 2단원 개념 정리"
              value={content}
              maxLength={ROADMAP_CONTENT_MAX + 10}
              onChange={(e) => setContent(e.target.value)}
              error={error ?? undefined}
            />
            <Button type="submit" className="self-end">
              계획 추가
            </Button>
          </form>
        </div>
      </Dialog>
      <RoadmapPicker open={pickFor !== null} onClose={() => setPickFor(null)} date={today} preselect={pickFor ? [pickFor] : []} />
    </>
  );
}
