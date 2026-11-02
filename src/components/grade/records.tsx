"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select";
import { Badge, SubjectTag } from "@/components/ui/tag";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { newId, useTableMutations } from "@/lib/data/crud";
import { useAllRows } from "@/lib/data/queries";
import { useSubjectMap, useSubjects } from "@/lib/data/subjects";
import { formatMonthDay } from "@/lib/date/days";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import type { RecordKind, RecordRow } from "@/lib/supabase/database.types";
import { useLayout } from "@/lib/use-layout";

export const RECORD_KIND_LABELS: Record<RecordKind, string> = { seteuk: "세특 탐구", reading: "독서", club: "동아리", etc: "기타" };
const key = ["records", "all", "date", false] as const;

/** 8.5 생기부 기록: 종류·과목 거르기, 글자 검색. 패드 가로·PC 는 목록 + 상세 */
export function Records() {
  const layout = useLayout();
  const { data } = useAllRows("records", { orderBy: "date" });
  const { data: subjectList } = useSubjects();
  const subjects = useSubjectMap();
  const { insert, update, trash } = useTableMutations("records");
  const [kind, setKind] = useState("");
  const [subject, setSubject] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecordRow | "new" | null>(null);
  const twoColumns = layout === "land" || layout === "pc";

  const list = [...(data ?? [])]
    .reverse()
    .filter((r) => (!kind || r.kind === kind) && (!subject || r.subject_id === subject) && (!q.trim() || `${r.title} ${r.content}`.includes(q.trim())));
  const current = (data ?? []).find((r) => r.id === selected);

  const detail = (r: RecordRow) => (
    <article className="flex flex-col gap-3" aria-label={r.title}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{RECORD_KIND_LABELS[r.kind]}</Badge>
        {r.subject_id && subjects.get(r.subject_id) ? <SubjectTag name={subjects.get(r.subject_id)!.name} color={subjects.get(r.subject_id)!.color_key} /> : null}
        <span className="text-12 text-sub">{formatMonthDay(r.date)}</span>
      </div>
      <h3 className="text-14 font-semibold">{r.title}</h3>
      <p className="text-13 whitespace-pre-wrap text-ink-2">{r.content || "내용 없음"}</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setEditing(r)}>
          수정
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            trash.mutate({ id: r.id });
            setSelected(null);
          }}
        >
          삭제
        </Button>
      </div>
    </article>
  );

  const listView = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 pad:grid-cols-3">
        <SelectField label="종류" value={kind} onChange={setKind} options={[{ value: "", label: "전체" }, ...(Object.keys(RECORD_KIND_LABELS) as RecordKind[]).map((k) => ({ value: k, label: RECORD_KIND_LABELS[k] }))]} />
        <SelectField label="과목" value={subject} onChange={setSubject} options={[{ value: "", label: "전체" }, ...(subjectList ?? []).map((s) => ({ value: s.id, label: s.name }))]} />
        <TextField label="검색" type="search" value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2 pad:col-span-1" />
      </div>
      {list.length === 0 ? (
        <EmptyState message={(data ?? []).length ? "조건에 맞는 기록이 없어요" : "아직 생기부 기록이 없어요"} />
      ) : (
        <ul className="flex flex-col">
          {list.map((r) => (
            <li key={r.id}>
              {twoColumns ? (
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  aria-current={selected === r.id ? "true" : undefined}
                  className={cn("flex w-full flex-col gap-0.5 rounded-input px-2 py-2 text-left", selected === r.id && "bg-surface-2")}
                >
                  <span className="truncate text-13 text-ink-2">{r.title}</span>
                  <span className="text-11 text-sub">
                    {RECORD_KIND_LABELS[r.kind]} · {formatMonthDay(r.date)}
                  </span>
                </button>
              ) : (
                <details className="border-b border-line py-2 last:border-b-0">
                  <summary className="flex cursor-pointer list-none flex-col gap-0.5">
                    <span className="truncate text-13 text-ink-2">{r.title}</span>
                    <span className="text-11 text-sub">
                      {RECORD_KIND_LABELS[r.kind]} · {formatMonthDay(r.date)}
                    </span>
                  </summary>
                  <div className="pt-3">{detail(r)}</div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus size={ICON_SIZE.inline} strokeWidth={ICON_STROKE} aria-hidden />
          기록 추가
        </Button>
      </div>
      {twoColumns ? (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-8">
          <Card>{listView}</Card>
          <Card>{current ? detail(current) : <p className="text-13 text-sub">목록에서 기록을 골라요</p>}</Card>
        </div>
      ) : (
        <Card>{listView}</Card>
      )}
      {editing ? (
        <RecordDialog
          record={editing === "new" ? null : editing}
          subjects={(subjectList ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onClose={() => setEditing(null)}
          onSubmit={(v) => {
            if (editing === "new") {
              const id = newId();
              insert.mutate({ rows: [{ id, ...v }], appendTo: key });
              setSelected(id);
            } else update.mutate({ ids: [editing.id], patch: v });
          }}
        />
      ) : null}
    </div>
  );
}

function RecordDialog({
  record,
  subjects,
  onClose,
  onSubmit,
}: {
  record: RecordRow | null;
  subjects: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (v: { kind: RecordKind; subject_id: string | null; title: string; date: string; content: string }) => void;
}) {
  const [kind, setKind] = useState<RecordKind>(record?.kind ?? "seteuk");
  const [subjectId, setSubjectId] = useState(record?.subject_id ?? "");
  const [title, setTitle] = useState(record?.title ?? "");
  const [date, setDate] = useState(record?.date ?? "");
  const [content, setContent] = useState(record?.content ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "제목을 입력해 주세요";
    else if (title.trim().length > 60) e.title = "60자 이내로 써 주세요";
    if (!date) e.date = "날짜를 골라 주세요";
    if (content.length > 2000) e.content = "2000자 이내로 써 주세요";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({ kind, subject_id: subjectId || null, title: title.trim(), date, content });
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={record ? "기록 수정" : "기록 추가"}
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
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="종류" value={kind} onChange={(v) => setKind(v as RecordKind)} options={(Object.keys(RECORD_KIND_LABELS) as RecordKind[]).map((k) => ({ value: k, label: RECORD_KIND_LABELS[k] }))} />
          <SelectField label="과목 (선택)" value={subjectId} onChange={setSubjectId} options={[{ value: "", label: "없음" }, ...subjects]} />
        </div>
        <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <TextField label="날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-12 text-sub">
            내용<span className="num text-11">{content.length}/2000</span>
          </span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check" />
          {errors.content ? <span className="text-12 text-urgent-ink">{errors.content}</span> : null}
        </label>
      </div>
    </Dialog>
  );
}
