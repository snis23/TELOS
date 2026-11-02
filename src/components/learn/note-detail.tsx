"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, SubjectTag } from "@/components/ui/tag";
import { useMockRounds, useNoteMutations, useNotePhotos, useNotes } from "@/lib/data/learn";
import { useUnits } from "@/lib/data/plan";
import { useSubjectMap } from "@/lib/data/subjects";
import { formatMonthDay } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import { KIND_LABELS, REASON_LABELS, REASON_TONES } from "@/lib/learn/notes";
import { NoteForm } from "./note-form";
import { NotePhoto } from "./photo";

/** 7.3 상세: 사진 크게(두 손가락으로 확대), 모든 항목, 해결로 표시 / 다시 풀기로 되돌리기, 수정, 삭제 */
export function NoteDetail({ noteId, onDeleted }: { noteId: string; onDeleted?: () => void }) {
  const { data: notes } = useNotes();
  const { data: photos } = useNotePhotos();
  const { data: units } = useUnits();
  const { data: rounds } = useMockRounds();
  const subjects = useSubjectMap();
  const { update, trash } = useNoteMutations();
  const [editing, setEditing] = useState(false);
  const note = (notes ?? []).find((n) => n.id === noteId);
  if (!note) return <p className="text-13 text-sub">오답을 찾을 수 없어요</p>;

  const subject = subjects.get(note.subject_id);
  const notePhotos = (photos ?? []).filter((p) => p.note_id === note.id).sort((a, b) => a.sort_order - b.sort_order);
  const unit = (units ?? []).find((u) => u.id === note.unit_id);
  const round = (rounds ?? []).find((r) => r.id === note.mock_round_id);
  const rows: [string, string | null][] = [
    ["종류", KIND_LABELS[note.kind]],
    ["단원", unit?.name ?? null],
    ["회차", round?.name ?? null],
    [note.kind === "school" ? "출처" : "문항 번호", note.kind === "school" ? note.source : note.question_no ? `${note.question_no}번` : null],
    ["배점", note.points ? `${note.points}점` : null],
    ["추가한 날", formatMonthDay(getStudyDate(new Date(note.created_at)))],
    ["해결한 날", note.solved_at ? formatMonthDay(getStudyDate(new Date(note.solved_at))) : null],
  ];

  return (
    <article className="flex flex-col gap-4" aria-label="오답 상세" data-testid="note-detail">
      <header className="flex flex-wrap items-center gap-2">
        {subject ? <SubjectTag name={subject.name} color={subject.color_key} /> : null}
        <Badge tone={REASON_TONES[note.reason]}>{REASON_LABELS[note.reason]}</Badge>
        <span className={note.solved_at ? "text-12 text-ok-ink" : "text-12 text-sub"}>{note.solved_at ? "해결" : "다시 풀기"}</span>
      </header>
      <div className="flex flex-col gap-3">
        {notePhotos.map((p, i) => (
          <NotePhoto key={p.id} path={p.storage_path} color={subject?.color_key} alt={`오답 사진 ${i + 1}`} className="min-h-40 w-full touch-pinch-zoom" />
        ))}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-13">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-sub">{k}</dt>
              <dd className="text-ink-2">{v}</dd>
            </div>
          ))}
      </dl>
      {note.memo ? <p className="rounded-input bg-surface-2 px-3 py-2 text-13 whitespace-pre-wrap text-ink-2">{note.memo}</p> : null}
      <div className="flex flex-wrap gap-2">
        {note.solved_at ? (
          <Button variant="secondary" onClick={() => update.mutate({ ids: [note.id], patch: { solved_at: null } })}>
            다시 풀기로 되돌리기
          </Button>
        ) : (
          <Button onClick={() => update.mutate({ ids: [note.id], patch: { solved_at: new Date().toISOString() } })}>해결로 표시</Button>
        )}
        <Button variant="secondary" onClick={() => setEditing(true)}>
          수정
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            trash.mutate({ id: note.id });
            onDeleted?.();
          }}
        >
          삭제
        </Button>
      </div>
      {editing ? (
        <NoteForm kind={note.kind} subjectId={note.subject_id} note={note} existingPhotoCount={notePhotos.length} onClose={() => setEditing(false)} />
      ) : null}
    </article>
  );
}
