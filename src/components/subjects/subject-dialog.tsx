"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { pickNextColor, type SubjectColorKey } from "@/lib/design/subject-colors";
import type { SubjectRow } from "@/lib/supabase/database.types";
import { fieldErrors } from "@/lib/validation/form";
import { SUBJECT_NAME_MAX, subjectFormSchema } from "@/lib/validation/subject";
import { ColorPicker } from "./color-picker";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 고칠 과목. 없으면 새로 만든다 */
  subject?: SubjectRow | null;
  subjects: readonly SubjectRow[];
  onSubmit: (values: { name: string; color_key: SubjectColorKey }) => void;
  onDelete?: () => void;
};

export function SubjectDialog(props: Props) {
  if (!props.open) return null;
  return <SubjectDialogBody key={props.subject?.id ?? "new"} {...props} />;
}

function SubjectDialogBody({ open, onClose, subject, subjects, onSubmit, onDelete }: Props) {
  const [name, setName] = useState(subject?.name ?? "");
  const [color, setColor] = useState<SubjectColorKey>(
    subject?.color_key ?? pickNextColor(subjects.map((s) => s.color_key)),
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const others = subjects.filter((s) => s.id !== subject?.id).map((s) => s.name);
    const parsed = subjectFormSchema(others).safeParse({ name, color_key: color });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    onSubmit(parsed.data);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={subject ? "과목 수정" : "과목 추가"}
      footer={
        <>
          {subject && onDelete ? (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              삭제
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="subject-form">
            저장
          </Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label="이름"
          value={name}
          maxLength={SUBJECT_NAME_MAX + 5}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-12 text-sub">색</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </form>
    </Dialog>
  );
}
