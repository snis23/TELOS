"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { SubjectDot } from "@/components/ui/subject-dot";
import { TimeSelect } from "@/components/ui/time-select";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useDayStartHour } from "@/lib/data/profile";
import { useSubjectMap, useSubjects } from "@/lib/data/subjects";
import { formatClock } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { SessionKind, TimerSessionRow } from "@/lib/supabase/database.types";
import { formatDurationKo } from "@/lib/timer/format";
import { clockToInstant, sessionSeconds } from "@/lib/timer/sessions";
import { useTimerContext } from "./timer-provider";

function clockOf(iso: string): number {
  const [h, m] = formatClock(iso).split(":").map(Number);
  return h * 60 + m;
}
const toClock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** 오늘 기록 목록: 시작·종료 시각 수정, 삭제, 직접 추가 (5.4 기록 수정, 5.5 쪽잠 목록) */
export function SessionListDialog({ open, onClose, kind }: { open: boolean; onClose: () => void; kind: SessionKind }) {
  const { sessions, now, today } = useTimerContext();
  const subjects = useSubjectMap();
  const [editing, setEditing] = useState<TimerSessionRow | "new" | null>(null);
  const { trash } = useTableMutations("timer_sessions");
  const list = sessions.filter((s) => s.kind === kind);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === "study" ? "오늘 공부 기록" : "오늘 쪽잠"}
      footer={
        editing ? null : (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
            직접 추가
          </Button>
        )
      }
    >
      {editing ? (
        <SessionEditor
          kind={kind}
          session={editing === "new" ? null : editing}
          today={today}
          now={now}
          onDone={() => setEditing(null)}
        />
      ) : list.length === 0 ? (
        <EmptyState message={kind === "study" ? "아직 공부 기록이 없어요" : "아직 쪽잠 기록이 없어요"} />
      ) : (
        <ul className="flex flex-col">
          {list.map((s) => {
            const subject = s.subject_id ? subjects.get(s.subject_id) : undefined;
            return (
              <li key={s.id} className="flex min-h-11 items-center gap-2 border-b border-line py-1 last:border-b-0">
                {kind === "study" ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {subject ? <SubjectDot color={subject.color_key} /> : null}
                    <span className="truncate text-13 text-ink-2">{subject?.name ?? "과목 없음"}</span>
                  </span>
                ) : null}
                <span className={kind === "study" ? "num text-12 text-sub" : "num flex-1 text-13 text-ink-2"}>
                  {formatClock(s.started_at)}–{s.ended_at ? formatClock(s.ended_at) : "측정 중"}
                </span>
                <span className="num w-16 text-right text-12 text-sub">{formatDurationKo(sessionSeconds(s, now))}</span>
                {s.ended_at ? (
                  <>
                    <IconButton aria-label="기록 수정" onClick={() => setEditing(s)}>
                      <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                    </IconButton>
                    <IconButton aria-label="기록 삭제" onClick={() => trash.mutate({ id: s.id })}>
                      <Trash2 size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                    </IconButton>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

function SessionEditor({
  kind,
  session,
  today,
  now,
  onDone,
}: {
  kind: SessionKind;
  session: TimerSessionRow | null;
  today: string;
  now: Date;
  onDone: () => void;
}) {
  const dayStartHour = useDayStartHour();
  const { data: subjectList } = useSubjects();
  const { insert, update } = useTableMutations("timer_sessions");
  const nowClock = clockOf(now.toISOString());
  const [subjectId, setSubjectId] = useState(session?.subject_id ?? subjectList?.[0]?.id ?? "");
  const [start, setStart] = useState(session ? clockOf(session.started_at) : Math.max(0, nowClock - 60));
  const [end, setEnd] = useState(session?.ended_at ? clockOf(session.ended_at) : nowClock);
  const [error, setError] = useState<string | null>(null);
  const studyDate = today;

  const save = () => {
    const startAt = clockToInstant(studyDate, toClock(start), dayStartHour);
    const endAt = clockToInstant(studyDate, toClock(end), dayStartHour);
    if (endAt <= startAt) return setError("끝 시각이 시작 시각보다 늦어야 해요");
    if (endAt > now) return setError("아직 오지 않은 시각이에요");
    if (kind === "study" && !subjectId) return setError("과목을 골라 주세요");
    const patch = {
      started_at: startAt.toISOString(),
      ended_at: endAt.toISOString(),
      subject_id: kind === "study" ? subjectId : null,
    };
    if (session) update.mutate({ ids: [session.id], patch });
    else insert.mutate({ rows: [{ id: newId(), kind, ...patch }] });
    onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      {kind === "study" ? (
        <SelectField
          label="과목"
          value={subjectId}
          onChange={setSubjectId}
          options={(subjectList ?? []).map((s) => ({ value: s.id, label: s.name }))}
        />
      ) : null}
      <div className="flex flex-wrap gap-4">
        <TimeSelect label="시작" value={start} onChange={setStart} firstHour={dayStartHour} />
        <TimeSelect label="끝" value={end} onChange={setEnd} firstHour={dayStartHour} />
      </div>
      {error ? <p className="text-12 text-urgent-ink">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button onClick={save}>저장</Button>
      </div>
    </div>
  );
}
