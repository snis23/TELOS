"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { SortableList } from "@/components/ui/sortable";
import { SubjectDot } from "@/components/ui/subject-dot";
import { SubjectDialog } from "@/components/subjects/subject-dialog";
import { newId } from "@/lib/data/crud";
import { subjectsKey, useSubjectMutations, useSubjects } from "@/lib/data/subjects";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { SubjectRow } from "@/lib/supabase/database.types";

/** 설정 > 과목 관리: 추가, 이름·색 수정, 끌어서 순서 바꾸기, 삭제(휴지통) */
export function SubjectManager() {
  const { data: subjects, isPending } = useSubjects();
  const { insert, update, trash, reorder } = useSubjectMutations();
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);

  if (isPending) return <CardSkeleton lines={4} />;
  const list = subjects ?? [];

  return (
    <Card
      title="과목 관리"
      actions={
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          과목 추가
        </Button>
      }
    >
      {list.length === 0 ? (
        <EmptyState message="아직 과목이 없어요" />
      ) : (
        <div className="flex flex-col">
          <SortableList items={list} onReorder={(ids) => reorder.mutate({ ids, key: subjectsKey })}>
            {(subject, handle) => (
              <div className="flex min-h-11 items-center gap-2 border-b border-line py-1 last:border-b-0">
                {handle}
                <SubjectDot color={subject.color_key} />
                <span className="min-w-0 flex-1 truncate text-14 text-ink-2">{subject.name}</span>
                <IconButton aria-label={`${subject.name} 수정`} onClick={() => setEditing(subject)}>
                  <Pencil size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} />
                </IconButton>
              </div>
            )}
          </SortableList>
          <p className="mt-3 text-12 text-sub">순서는 타이머 과목 칩과 숫자 단축키(1~8) 순서예요</p>
        </div>
      )}

      <SubjectDialog
        open={adding}
        onClose={() => setAdding(false)}
        subjects={list}
        onSubmit={(values) =>
          insert.mutate({
            rows: [{ id: newId(), ...values, sort_order: list.length }],
            appendTo: subjectsKey,
          })
        }
      />
      <SubjectDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        subject={editing}
        subjects={list}
        onSubmit={(values) => {
          if (editing) update.mutate({ ids: [editing.id], patch: values });
        }}
        onDelete={() => {
          setDeleting(editing);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`${deleting?.name ?? ""} 과목을 삭제할까요?`}
        message="이 과목의 오답, 단원, 성적, 목표 등급, 시험 범위도 함께 휴지통으로 가요. 7일 안에는 되돌릴 수 있어요."
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          if (deleting) trash.mutate({ id: deleting.id });
        }}
      />
    </Card>
  );
}
