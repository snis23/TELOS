"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Ellipsis, Plus } from "lucide-react";
import { SubjectDialog } from "@/components/subjects/subject-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { SortableList } from "@/components/ui/sortable";
import { Badge } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/data/crud";
import { useMockRounds, useNotePhotos, useNotes } from "@/lib/data/learn";
import { useUnits } from "@/lib/data/plan";
import { subjectsKey, useSubjectMutations, useSubjects } from "@/lib/data/subjects";
import { formatMonthDay } from "@/lib/date/days";
import { getStudyDate } from "@/lib/date/study-date";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { KIND_LABELS, REASON_LABELS, REASON_TONES, groupNotes, noteSummary } from "@/lib/learn/notes";
import type { NoteKind, NoteReason, SubjectRow, WrongNoteRow } from "@/lib/supabase/database.types";
import { useLayout } from "@/lib/use-layout";
import { NoteDetail } from "./note-detail";
import { NoteForm } from "./note-form";
import { NotePhoto } from "./photo";

const PAGE = 50;
const STATE_KEY = "telos:notes-state";

function readState(): { kind: NoteKind; subjectId: string | null } {
  try {
    return JSON.parse(window.localStorage.getItem(STATE_KEY) ?? "") as { kind: NoteKind; subjectId: string | null };
  } catch {
    return { kind: "school", subjectId: null };
  }
}

const showKey = (kind: NoteKind) => (kind === "school" ? "show_in_school_notes" : "show_in_mock_notes");

/** 7.1 오답노트 화면 */
export function NotesScreen() {
  const router = useRouter();
  const layout = useLayout();
  const twoColumns = layout === "land" || layout === "pc";
  const { data: notesData } = useNotes();
  const { data: photos } = useNotePhotos();
  const { data: units } = useUnits();
  const { data: rounds } = useMockRounds();
  const { data: subjectsData } = useSubjects();
  const subjectMut = useSubjectMutations();
  const [state, setStateRaw] = useState(readState);
  const [reason, setReason] = useState<"all" | NoteReason>("all");
  const [status, setStatus] = useState<"all" | "open" | "solved">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [adding, setAdding] = useState<File[] | null>(null);
  const [addSubject, setAddSubject] = useState(false);
  const [chipMenu, setChipMenu] = useState<SubjectRow | null>(null);
  const [editSubject, setEditSubject] = useState<SubjectRow | null>(null);
  const [removeChoice, setRemoveChoice] = useState<SubjectRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SubjectRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setState = (next: Partial<typeof state>) => {
    const v = { ...state, ...next };
    setStateRaw(v);
    setSelected(null);
    setLimit(PAGE);
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(v));
    } catch {
      // 무시
    }
  };

  const notes = useMemo(() => notesData ?? [], [notesData]);
  const subjects = subjectsData ?? [];
  const kind = state.kind;
  const visibleSubjects = subjects.filter((s) => s[showKey(kind)] && !s.hidden_at);
  const subject = visibleSubjects.find((s) => s.id === state.subjectId) ?? visibleSubjects[0] ?? null;
  const unsolvedOf = (k: NoteKind, sid?: string) => notes.filter((n) => n.kind === k && !n.solved_at && (!sid || n.subject_id === sid)).length;

  const scoped = notes.filter((n) => n.kind === kind && n.subject_id === subject?.id);
  const summary = noteSummary(scoped);
  const filtered = scoped.filter(
    (n) => (reason === "all" || n.reason === reason) && (status === "all" || (status === "open" ? !n.solved_at : Boolean(n.solved_at))),
  );
  const allGroups = groupNotes(filtered, kind, (units ?? []).filter((u) => u.subject_id === subject?.id), rounds ?? []);
  // 50개가 넘으면 나눠서 보여 준다 (10.1 성능)
  const groups = allGroups.reduce<{ list: typeof allGroups; used: number }>(
    (acc, g) => {
      const room = limit - acc.used;
      if (room <= 0) return acc;
      const notes = g.notes.slice(0, room);
      return { list: [...acc.list, { ...g, total: g.notes.length, notes }], used: acc.used + notes.length };
    },
    { list: [], used: 0 },
  ).list as (ReturnType<typeof groupNotes<WrongNoteRow>>[number] & { total: number })[];

  const firstPhoto = (note: WrongNoteRow) =>
    (photos ?? []).filter((p) => p.note_id === note.id).sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;

  const openNote = (n: WrongNoteRow) => {
    if (twoColumns) setSelected(n.id);
    else router.push(`/learn/note/?id=${n.id}`);
  };

  const hideOrDelete = (s: SubjectRow) => {
    const has = notes.some((n) => n.subject_id === s.id && n.kind === kind);
    setChipMenu(null);
    if (!has) subjectMut.update.mutate({ ids: [s.id], patch: { [showKey(kind)]: false } });
    else setRemoveChoice(s);
  };

  const list = (
    <div className="flex flex-col gap-5">
      {groups.length === 0 ? (
        <EmptyState
          message={scoped.length === 0 ? "아직 기록한 오답이 없어요" : "조건에 맞는 오답이 없어요"}
          action={
            scoped.length === 0 ? (
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                사진으로 추가
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {groups.map((g) => {
        const items = g.notes;
        return (
          <section key={g.key} aria-label={g.label}>
            <h3 className="mb-1 text-12 text-sub">
              {g.label} · <span className="num">{g.total}</span>
            </h3>
            <ul className="flex flex-col">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNote(n)}
                    aria-current={selected === n.id ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-input px-1 py-2 text-left",
                      selected === n.id && "bg-surface-2",
                    )}
                    data-testid="note-item"
                  >
                    <NotePhoto path={firstPhoto(n)} color={subject?.color_key} alt="" thumb className="size-13 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className={cn("truncate text-13", n.solved_at ? "text-sub line-through" : "text-ink-2")}>
                        {n.kind === "school" ? n.source || "출처 없음" : n.question_no ? `${n.question_no}번` : "문항 번호 없음"}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={REASON_TONES[n.reason]}>{REASON_LABELS[n.reason]}</Badge>
                        <span className="text-11 text-sub">
                          {n.kind === "mock" && n.points ? `${n.points}점` : formatMonthDay(getStudyDate(new Date(n.created_at)))}
                        </span>
                      </span>
                    </span>
                    <span data-subject={subject?.color_key} className={cn("shrink-0 text-12", n.solved_at ? "text-ok-ink" : "font-medium text-s-tag-ink")}>
                      {n.solved_at ? "해결" : "다시 풀기"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {filtered.length > limit ? (
        <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>
          더 보기
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-18 font-semibold">오답노트</h2>
        <Button pill onClick={() => fileInput.current?.click()} disabled={!subject}>
          <Camera size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          사진으로 추가
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="오답 사진 고르기"
          data-testid="note-file-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            setAdding(files);
          }}
        />
      </div>

      <Segmented
        label="종류"
        value={kind}
        onChange={(v) => setState({ kind: v, subjectId: null })}
        options={(["school", "mock"] as const).map((k) => ({ value: k, label: `${KIND_LABELS[k]} ${unsolvedOf(k)}` }))}
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="과목">
        <SortableList
          items={visibleSubjects}
          axis="horizontal"
          wholeItem
          onReorder={(ids) => subjectMut.reorder.mutate({ ids: [...ids, ...subjects.filter((s) => !ids.includes(s.id)).map((s) => s.id)], key: subjectsKey })}
          onHold={(id) => setChipMenu(subjects.find((s) => s.id === id) ?? null)}
        >
          {(s) => {
            const on = s.id === subject?.id;
            return (
              <span className="mr-2 inline-flex">
                <button
                  type="button"
                  aria-pressed={on}
                  data-subject={s.color_key}
                  onClick={() => setState({ subjectId: s.id })}
                  className={cn(
                    "inline-flex h-chip-phone shrink-0 items-center gap-1.5 rounded-full px-3.5 text-13 whitespace-nowrap pad:h-chip",
                    on ? "bg-s-tag font-semibold text-s-tag-ink" : "bg-surface text-ink-2",
                  )}
                >
                  {s.name}
                  <span className="num text-11">{unsolvedOf(kind, s.id)}</span>
                </button>
                {on ? (
                  <button
                    type="button"
                    aria-label={`${s.name} 과목 메뉴`}
                    onClick={() => setChipMenu(s)}
                    className="hit inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sub hover:text-ink"
                  >
                    <Ellipsis size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                  </button>
                ) : null}
              </span>
            );
          }}
        </SortableList>
        <button
          type="button"
          onClick={() => setAddSubject(true)}
          className="inline-flex h-chip-phone shrink-0 items-center gap-1 rounded-full border border-dashed border-line-2 px-3.5 text-13 whitespace-nowrap text-sub pad:h-chip"
        >
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          과목
        </button>
      </div>

      {subject ? (
        <>
          <section className="grid grid-cols-3 gap-3" aria-label="요약">
            <div className="rounded-item bg-surface p-4">
              <p className="text-12 text-sub">다시 풀 문제</p>
              <p className="num text-22 font-medium" data-testid="note-unsolved">
                {summary.unsolved}
              </p>
            </div>
            <div className="rounded-item bg-surface p-4">
              <p className="text-12 text-sub">해결</p>
              <p className="num text-22 font-medium">{summary.solved}</p>
            </div>
            <div className="rounded-item bg-surface p-4">
              <p className="text-12 text-sub">많이 틀린 이유</p>
              <p className="mt-1 text-14 font-medium">{summary.topReason ? REASON_LABELS[summary.topReason] : "–"}</p>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <Segmented
              label="틀린 이유 거르기"
              value={reason}
              onChange={setReason}
              options={[{ value: "all", label: "전체" }, ...(Object.keys(REASON_LABELS) as NoteReason[]).map((r) => ({ value: r, label: REASON_LABELS[r] }))]}
            />
            <Segmented
              label="상태 거르기"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "전체" },
                { value: "open", label: "다시 풀기" },
                { value: "solved", label: "해결" },
              ]}
            />
          </div>

          {twoColumns ? (
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-8">
              <div className="card">{list}</div>
              <div className="card sticky top-6">
                {selected ? <NoteDetail noteId={selected} onDeleted={() => setSelected(null)} /> : <p className="text-13 text-sub">목록에서 오답을 골라요</p>}
              </div>
            </div>
          ) : (
            <div className="card">{list}</div>
          )}
        </>
      ) : (
        <div className="card">
          <EmptyState message={`${KIND_LABELS[kind]} 오답노트에 보이는 과목이 없어요`} action={<Button variant="secondary" onClick={() => setAddSubject(true)}>과목 추가</Button>} />
        </div>
      )}

      {adding && subject ? <NoteForm kind={kind} subjectId={subject.id} initialFiles={adding} onClose={() => setAdding(null)} /> : null}

      {addSubject ? (
        <AddSubjectDialog
          kind={kind}
          hidden={subjects.filter((s) => !s[showKey(kind)] || s.hidden_at)}
          subjects={subjects}
          onClose={() => setAddSubject(false)}
          onShow={(s) => {
            subjectMut.update.mutate({ ids: [s.id], patch: { [showKey(kind)]: true, hidden_at: null } });
            setState({ subjectId: s.id });
          }}
          onCreate={(v) => {
            const id = newId();
            subjectMut.insert.mutate({
              rows: [{ id, ...v, sort_order: subjects.length, show_in_school_notes: kind === "school", show_in_mock_notes: kind === "mock" }],
              appendTo: subjectsKey,
            });
            setState({ subjectId: id });
          }}
        />
      ) : null}

      {chipMenu ? (
        <Dialog open onClose={() => setChipMenu(null)} title={`${chipMenu.name} 과목`}>
          <div className="flex flex-col gap-2 pb-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditSubject(chipMenu);
                setChipMenu(null);
              }}
            >
              이름·색 수정
            </Button>
            <Button variant="danger" onClick={() => hideOrDelete(chipMenu)}>
              이 종류에서 숨기기 또는 삭제
            </Button>
          </div>
        </Dialog>
      ) : null}
      <SubjectDialog
        open={editSubject !== null}
        subject={editSubject}
        subjects={subjects}
        onClose={() => setEditSubject(null)}
        onSubmit={(v) => editSubject && subjectMut.update.mutate({ ids: [editSubject.id], patch: v })}
      />
      {removeChoice ? (
        <Dialog
          open
          onClose={() => setRemoveChoice(null)}
          title={`${removeChoice.name} 과목에 오답이 있어요`}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  subjectMut.update.mutate({ ids: [removeChoice.id], patch: { [showKey(kind)]: false } });
                  setRemoveChoice(null);
                }}
              >
                숨기기(오답 유지)
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmDelete(removeChoice);
                  setRemoveChoice(null);
                }}
              >
                삭제(오답까지 휴지통으로)
              </Button>
            </>
          }
        >
          <p className="text-13 text-ink-2">숨기면 오답은 그대로 남아요. 삭제하면 과목과 오답이 함께 휴지통으로 가요.</p>
        </Dialog>
      ) : null}
      <ConfirmDialog
        open={confirmDelete !== null}
        title={`${confirmDelete?.name ?? ""} 과목을 정말 삭제할까요?`}
        message="과목과 이 과목의 오답, 단원, 성적이 모두 휴지통으로 가요. 7일 안에는 되돌릴 수 있어요."
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          if (confirmDelete) subjectMut.trash.mutate({ id: confirmDelete.id });
          setState({ subjectId: null });
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function AddSubjectDialog({
  kind,
  hidden,
  subjects,
  onClose,
  onShow,
  onCreate,
}: {
  kind: NoteKind;
  hidden: SubjectRow[];
  subjects: SubjectRow[];
  onClose: () => void;
  onShow: (s: SubjectRow) => void;
  onCreate: (v: { name: string; color_key: SubjectRow["color_key"] }) => void;
}) {
  const [creating, setCreating] = useState(false);
  if (creating) {
    return <SubjectDialog open subjects={subjects} onClose={onClose} onSubmit={onCreate} />;
  }
  return (
    <Dialog open onClose={onClose} title={`${KIND_LABELS[kind]} 오답노트에 과목 추가`}>
      <div className="flex flex-col gap-3 pb-2">
        {hidden.length ? (
          <>
            <p className="text-12 text-sub">있는 과목 보이기</p>
            <div className="flex flex-wrap gap-2">
              {hidden.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-subject={s.color_key}
                  onClick={() => {
                    onShow(s);
                    onClose();
                  }}
                  className="control-h rounded-full bg-s-tag px-3.5 text-13 text-s-tag-ink"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />새 과목 만들기
        </Button>
      </div>
    </Dialog>
  );
}
