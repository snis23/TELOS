"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { TermReviewDialog } from "@/components/subjects/term-review-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { SortableList } from "@/components/ui/sortable";
import { SubjectDot } from "@/components/ui/subject-dot";
import { SubjectDialog } from "@/components/subjects/subject-dialog";
import { newId } from "@/lib/data/crud";
import { useTerm } from "@/lib/data/profile";
import { subjectsKey, useAllSubjects, useSubjectMutations } from "@/lib/data/subjects";
import { useToday } from "@/lib/data/today";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { activeSchoolSubjects, archivedSubjects, mockSubjects, termLabel } from "@/lib/subjects/subjects";
import type { SubjectRow } from "@/lib/supabase/database.types";

/**
 * 설정 > 과목 관리
 * - 모의고사 과목: 고정 6개. 색만 바꾼다.
 * - 내신 과목: 학기마다 추가·보관. 보관해도 기록(오답·공부 시간·로드맵)은 남는다.
 */
export function SubjectManager() {
  const today = useToday();
  const term = useTerm(today);
  const { data: all, isPending } = useAllSubjects();
  const { insert, update, trash, reorder } = useSubjectMutations();
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  if (isPending) return <CardSkeleton lines={4} />;
  const list = all ?? [];
  const mock = mockSubjects(list);
  const school = activeSchoolSubjects(list);
  const archived = archivedSubjects(list);
  const sameKind = (s: SubjectRow | null) => (s?.kind === "mock" ? mock : school);

  const archive = (s: SubjectRow) => update.mutate({ ids: [s.id], patch: { archived_at: new Date().toISOString() } });
  const unarchive = (s: SubjectRow) => update.mutate({ ids: [s.id], patch: { archived_at: null } });
  /** 내신 과목 순서 저장 (모의고사 과목은 그대로 앞에 둔다) */
  const saveOrder = (ids: string[]) => reorder.mutate({ ids: [...mock.map((m) => m.id), ...ids], key: subjectsKey });
  const move = (subject: SubjectRow, delta: -1 | 1) => {
    const ids = school.map((s) => s.id);
    const i = ids.indexOf(subject.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    saveOrder(ids);
  };

  return (
    <Card
      title="과목 관리"
      actions={
        <Button variant="secondary" onClick={() => setReviewOpen(true)}>
          학기 정리
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <section aria-label="모의고사 과목">
          <h3 className="mb-1 text-13 font-medium text-ink-2">모의고사 과목</h3>
          <p className="mb-2 text-12 text-sub">고정 과목이에요. 색만 바꿀 수 있어요.</p>
          <div className="flex flex-col">
            {mock.map((subject) => (
              <SubjectLine key={subject.id} subject={subject} onEdit={() => setEditing(subject)} />
            ))}
          </div>
        </section>

        <section aria-label="내신 과목">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-13 font-medium text-ink-2">
              내신 과목{term.key ? <span className="ml-1.5 font-normal text-sub">· {termLabel(term.key)}</span> : null}
            </h3>
            <Button variant="text" onClick={() => setAdding(true)}>
              <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
              내신 과목 추가
            </Button>
          </div>
          {school.length === 0 ? (
            <EmptyState message="이번 학기 내신 과목을 추가해 주세요" />
          ) : (
            <SortableList items={school} onReorder={saveOrder}>
              {(subject, handle) => {
                const i = school.indexOf(subject);
                return (
                  <SubjectLine
                    subject={subject}
                    handle={handle}
                    onEdit={() => setEditing(subject)}
                    extra={
                      <>
                        <IconButton aria-label={`${subject.name} 위로`} disabled={i === 0} onClick={() => move(subject, -1)}>
                          <ChevronUp size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                        </IconButton>
                        <IconButton aria-label={`${subject.name} 아래로`} disabled={i === school.length - 1} onClick={() => move(subject, 1)}>
                          <ChevronDown size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                        </IconButton>
                        <IconButton aria-label={`${subject.name} 보관`} onClick={() => archive(subject)}>
                          <Archive size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                        </IconButton>
                      </>
                    }
                  />
                );
              }}
            </SortableList>
          )}
          <p className="mt-3 text-12 text-sub">
            ▲▼ 버튼이나 손잡이를 끌어서 순서를 바꿔요. 이 순서가 타이머 내신 칩과 숫자 단축키(1~8) 순서예요. 학기가 끝난 과목은 보관하세요. 고르는 목록에서만 빠지고 오답·공부 시간·로드맵 기록은 남아요.
          </p>
        </section>

        {archived.length > 0 ? (
          <section aria-label="보관한 과목">
            <button
              type="button"
              className="text-13 font-medium text-ink-2"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              보관한 과목 {archived.length}개 {showArchived ? "접기" : "보기"}
            </button>
            {showArchived ? (
              <div className="mt-2 flex flex-col">
                {archived.map((subject) => (
                  <SubjectLine
                    key={subject.id}
                    subject={subject}
                    note={subject.term ? termLabel(subject.term) : undefined}
                    onEdit={() => setEditing(subject)}
                    extra={
                      subject.kind === "school" ? (
                        <IconButton aria-label={`${subject.name} 보관 풀기`} onClick={() => unarchive(subject)}>
                          <ArchiveRestore size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                        </IconButton>
                      ) : null
                    }
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <SubjectDialog
        open={adding}
        onClose={() => setAdding(false)}
        title="내신 과목 추가"
        subjects={school}
        onSubmit={(values) =>
          insert.mutate({
            rows: [{ id: newId(), ...values, kind: "school", term: term.key, sort_order: list.length }],
            appendTo: subjectsKey,
          })
        }
      />
      <SubjectDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        subject={editing}
        subjects={editing?.archived_at ? [] : sameKind(editing)}
        lockName={editing?.kind === "mock"}
        onSubmit={(values) => {
          if (editing) update.mutate({ ids: [editing.id], patch: values });
        }}
        onDelete={
          editing?.kind === "school"
            ? () => {
                setDeleting(editing);
                setEditing(null);
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`${deleting?.name ?? ""} 과목을 삭제할까요?`}
        message="이 과목의 오답, 단원, 시험 로드맵 계획도 함께 휴지통으로 가요. 7일 안에는 되돌릴 수 있어요. 기록을 남기려면 삭제 대신 보관하세요."
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          if (deleting) trash.mutate({ id: deleting.id });
        }}
      />
      <TermReviewDialog open={reviewOpen} onClose={() => setReviewOpen(false)} />
    </Card>
  );
}

function SubjectLine({
  subject,
  handle,
  note,
  extra,
  onEdit,
}: {
  subject: SubjectRow;
  handle?: React.ReactNode;
  note?: string;
  extra?: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-line py-1 last:border-b-0">
      {handle}
      <SubjectDot color={subject.color_key} />
      <span className="min-w-0 flex-1 truncate text-14 text-ink-2">
        {subject.name}
        {note ? <span className="ml-1.5 text-12 text-sub">{note}</span> : null}
      </span>
      {extra}
      <IconButton aria-label={`${subject.name} 수정`} onClick={onEdit}>
        <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
      </IconButton>
    </div>
  );
}
