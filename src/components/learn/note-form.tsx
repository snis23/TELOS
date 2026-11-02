"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { z } from "zod";
import { NameDialog } from "@/components/settings/timetable-settings";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { useUserId } from "@/lib/auth/auth-provider";
import { newId, useTableMutations } from "@/lib/data/crud";
import { NOTE_BUCKET, useMockRounds } from "@/lib/data/learn";
import { useUnits } from "@/lib/data/plan";
import { useSubjects } from "@/lib/data/subjects";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { idbDelete, idbGet, idbSet } from "@/lib/idb";
import { MAX_PHOTOS, REASON_LABELS, photoPath } from "@/lib/learn/notes";
import { compressPhoto } from "@/lib/photos/compress";
import { requireSupabase } from "@/lib/supabase/client";
import type { NoteKind, NoteReason, WrongNoteRow } from "@/lib/supabase/database.types";
import { fieldErrors } from "@/lib/validation/form";
import { RoundDialog } from "./round-dialog";

export const DRAFT_KEY = "telos:note-draft";

/** 7.3 오답 항목 규칙 (DB CHECK 와 같다) */
export const noteSchema = z
  .object({
    kind: z.enum(["school", "mock"]),
    subject_id: z.string().min(1, "과목을 골라 주세요"),
    unit_id: z.string().nullable(),
    mock_round_id: z.string().nullable(),
    source: z.string().trim().max(60, "60자 이내로 써 주세요"),
    question_no: z.number().int().min(1, "1~45 사이로 써 주세요").max(45, "1~45 사이로 써 주세요").nullable(),
    points: z.union([z.literal(2), z.literal(3), z.literal(4)]).nullable(),
    reason: z.enum(["concept", "slip", "time"], { error: "틀린 이유를 골라 주세요" }),
    memo: z.string().max(500, "500자 이내로 써 주세요"),
    photoCount: z.number().int().min(1, "사진을 1장 이상 넣어 주세요").max(MAX_PHOTOS, `사진은 ${MAX_PHOTOS}장까지예요`),
  })
  .refine((v) => v.kind !== "school" || v.unit_id, { path: ["unit_id"], message: "단원을 골라 주세요" })
  .refine((v) => v.kind !== "mock" || v.mock_round_id, { path: ["mock_round_id"], message: "회차를 골라 주세요" });

export type NoteValues = z.infer<typeof noteSchema>;

type LocalPhoto = { id: string; blob: Blob; width: number; height: number; url: string };
type Draft = { noteId: string; values: Omit<NoteValues, "photoCount">; photos: { id: string; blob: Blob; width: number; height: number }[] };

class UploadError extends Error {}

/** 사진 올리기 → 오답 저장. 사진이 다 올라가기 전에는 저장 완료로 표시하지 않는다 (7.3) */
async function uploadAndSave(userId: string, noteId: string, values: Omit<NoteValues, "photoCount">, photos: LocalPhoto[]) {
  const supabase = requireSupabase();
  for (const p of photos) {
    const { error } = await supabase.storage
      .from(NOTE_BUCKET)
      .upload(photoPath(userId, noteId, p.id), p.blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw new UploadError(error.message);
  }
  const note = {
    id: noteId,
    ...values,
    source: values.source || null,
    memo: values.memo || null,
    unit_id: values.unit_id,
    mock_round_id: values.kind === "mock" ? values.mock_round_id : null,
    question_no: values.kind === "mock" ? values.question_no : null,
    points: values.kind === "mock" ? values.points : null,
  };
  const ins = await supabase.from("wrong_notes").upsert(note, { onConflict: "id" });
  if (ins.error) throw ins.error;
  const rows = photos.map((p, i) => ({
    id: p.id,
    note_id: noteId,
    storage_path: photoPath(userId, noteId, p.id),
    sort_order: i,
    width: p.width,
    height: p.height,
  }));
  const ph = await supabase.from("wrong_note_photos").upsert(rows, { onConflict: "id" });
  if (ph.error) throw ph.error;
}

export function NoteForm({
  kind,
  subjectId,
  note,
  existingPhotoCount = 0,
  initialFiles,
  onClose,
}: {
  kind: NoteKind;
  subjectId: string | null;
  /** 고칠 오답 (없으면 새로 만든다) */
  note?: WrongNoteRow | null;
  existingPhotoCount?: number;
  /** "사진으로 추가"에서 고른 파일 */
  initialFiles?: File[];
  onClose: () => void;
}) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { data: subjects } = useSubjects();
  const { data: units } = useUnits();
  const { data: rounds } = useMockRounds();
  const unitMut = useTableMutations("units");
  const roundMut = useTableMutations("mock_rounds", { unique: "같은 회차가 이미 있어요" });
  const noteMut = useTableMutations("wrong_notes");
  const fileInput = useRef<HTMLInputElement>(null);

  const [noteId, setNoteId] = useState(note?.id ?? newId());
  const [values, setValues] = useState<Omit<NoteValues, "photoCount">>({
    kind: note?.kind ?? kind,
    subject_id: note?.subject_id ?? subjectId ?? "",
    unit_id: note?.unit_id ?? null,
    mock_round_id: note?.mock_round_id ?? null,
    source: note?.source ?? "",
    question_no: note?.question_no ?? null,
    points: (note?.points as 2 | 3 | 4 | null) ?? null,
    reason: note?.reason ?? ("" as NoteReason),
    memo: note?.memo ?? "",
  });
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [newUnit, setNewUnit] = useState(false);
  const [newRound, setNewRound] = useState(false);

  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const subjectUnits = useMemo(
    () => (units ?? []).filter((u) => u.subject_id === values.subject_id),
    [units, values.subject_id],
  );
  const total = existingPhotoCount + photos.length;

  const addFiles = async (files: File[]) => {
    const room = MAX_PHOTOS - total;
    const chosen = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (files.length > room) setErrors((e) => ({ ...e, photoCount: `사진은 ${MAX_PHOTOS}장까지예요` }));
    setBusy(true);
    try {
      const done = await Promise.all(chosen.map(compressPhoto));
      setPhotos((prev) => [
        ...prev,
        ...done.map((d) => ({ id: newId(), ...d, url: URL.createObjectURL(d.blob) })),
      ]);
    } finally {
      setBusy(false);
    }
  };

  // 처음 열 때: 고른 사진을 압축하고, 저장하지 못한 초안이 있으면 이어서 쓴다
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!note) {
        const draft = await idbGet<Draft>(DRAFT_KEY);
        if (alive && draft) {
          setNoteId(draft.noteId);
          setValues(draft.values);
          setPhotos(draft.photos.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })));
          setRestored(true);
          setUploadFailed(true);
        }
      }
      if (alive && initialFiles?.length) await addFiles(initialFiles);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const parsed = noteSchema.safeParse({ ...values, photoCount: total });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    setBusy(true);
    try {
      if (note) {
        // 고치기: 글 내용은 바로 저장하고, 새로 넣은 사진만 올린다
        const { photoCount: _x, ...patch } = parsed.data;
        void _x;
        noteMut.update.mutate({
          ids: [note.id],
          patch: { ...patch, source: patch.source || null, memo: patch.memo || null },
        });
        if (photos.length) {
          const supabase = requireSupabase();
          for (const [i, p] of photos.entries()) {
            const path = photoPath(userId, note.id, p.id);
            const up = await supabase.storage.from(NOTE_BUCKET).upload(path, p.blob, { contentType: "image/jpeg", upsert: true });
            if (up.error) throw new UploadError(up.error.message);
            const ins = await supabase.from("wrong_note_photos").upsert(
              { id: p.id, note_id: note.id, storage_path: path, sort_order: existingPhotoCount + i, width: p.width, height: p.height },
              { onConflict: "id" },
            );
            if (ins.error) throw ins.error;
          }
        }
      } else {
        await uploadAndSave(userId, noteId, values, photos);
        await idbDelete(DRAFT_KEY);
      }
      void queryClient.invalidateQueries({ queryKey: ["wrong_notes"] });
      void queryClient.invalidateQueries({ queryKey: ["wrong_note_photos"] });
      onClose();
    } catch {
      // 입력 내용은 기기에 임시 저장하고 다시 시도할 수 있게 둔다
      if (!note) {
        await idbSet(DRAFT_KEY, {
          noteId,
          values,
          photos: photos.map(({ id, blob, width, height }) => ({ id, blob, width, height })),
        } satisfies Draft);
      }
      setUploadFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const discardDraft = async () => {
    await idbDelete(DRAFT_KEY);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={note ? "오답 수정" : "오답 추가"}
      footer={
        <>
          {restored && !note ? (
            <Button variant="danger" className="mr-auto" onClick={() => void discardDraft()}>
              버리기
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "저장하는 중" : "저장"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {uploadFailed ? (
          <div role="alert" className="flex items-center justify-between gap-2 rounded-input bg-urgent-bg px-3 py-2 text-13 text-urgent-ink">
            <span>{restored ? "저장하지 못한 오답이에요. 이어서 저장해요" : "사진을 올리지 못했어요"}</span>
            <button type="button" className="font-semibold" onClick={() => void save()} disabled={busy}>
              다시 시도
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-12 text-sub">
            사진 <span className="num">{total}/{MAX_PHOTOS}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative size-20 overflow-hidden rounded-input bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- 기기 안의 미리보기 */}
                <img src={p.url} alt="고른 사진" className="size-full object-cover" />
                <button
                  type="button"
                  aria-label="사진 빼기"
                  onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}
                  className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-btn text-btn-ink"
                >
                  <X size={ICON_SIZE.pin} strokeWidth={ICON_STROKE} />
                </button>
              </div>
            ))}
            {total < MAX_PHOTOS ? (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex size-20 flex-col items-center justify-center gap-1 rounded-input border border-dashed border-line-2 text-11 text-sub"
              >
                <ImagePlus size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} aria-hidden />
                사진 넣기
              </button>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-label="사진 고르기"
              onChange={(e) => {
                void addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </div>
          {errors.photoCount ? <p className="text-12 text-urgent-ink">{errors.photoCount}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="종류"
            value={values.kind}
            onChange={(v) => set({ kind: v as NoteKind })}
            options={[
              { value: "school", label: "내신" },
              { value: "mock", label: "모의고사" },
            ]}
          />
          <SelectField
            label="과목"
            value={values.subject_id}
            onChange={(v) => set({ subject_id: v, unit_id: null })}
            error={errors.subject_id}
            options={[{ value: "", label: "고르기" }, ...(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          />
        </div>

        {values.kind === "school" ? (
          <SelectField
            label="단원"
            value={values.unit_id ?? ""}
            onChange={(v) => (v === "__new" ? setNewUnit(true) : set({ unit_id: v || null }))}
            error={errors.unit_id}
            options={[
              { value: "", label: "고르기" },
              ...subjectUnits.map((u) => ({ value: u.id, label: u.name })),
              ...(values.subject_id ? [{ value: "__new", label: "+ 새 단원" }] : []),
            ]}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="회차"
              value={values.mock_round_id ?? ""}
              onChange={(v) => (v === "__new" ? setNewRound(true) : set({ mock_round_id: v || null }))}
              error={errors.mock_round_id}
              options={[
                { value: "", label: "고르기" },
                ...[...(rounds ?? [])].sort((a, b) => b.year - a.year || b.month - a.month).map((r) => ({ value: r.id, label: r.name })),
                { value: "__new", label: "+ 새 회차" },
              ]}
            />
            <SelectField
              label="단원 (선택)"
              value={values.unit_id ?? ""}
              onChange={(v) => (v === "__new" ? setNewUnit(true) : set({ unit_id: v || null }))}
              options={[
                { value: "", label: "없음" },
                ...subjectUnits.map((u) => ({ value: u.id, label: u.name })),
                ...(values.subject_id ? [{ value: "__new", label: "+ 새 단원" }] : []),
              ]}
            />
          </div>
        )}

        {values.kind === "school" ? (
          <TextField label="출처 (예: 문제집 p.91 12번)" value={values.source} onChange={(e) => set({ source: e.target.value })} error={errors.source} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="문항 번호 (1~45)"
              inputMode="numeric"
              value={values.question_no === null ? "" : String(values.question_no)}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                set({ question_no: v === "" ? null : Number(v) });
              }}
              error={errors.question_no}
            />
            <SelectField
              label="배점 (선택)"
              value={values.points === null ? "" : String(values.points)}
              onChange={(v) => set({ points: v === "" ? null : (Number(v) as 2 | 3 | 4) })}
              options={[
                { value: "", label: "없음" },
                { value: "2", label: "2점" },
                { value: "3", label: "3점" },
                { value: "4", label: "4점" },
              ]}
            />
          </div>
        )}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-12 text-sub">틀린 이유</legend>
          <div role="radiogroup" aria-label="틀린 이유" className="flex flex-wrap gap-2">
            {(Object.keys(REASON_LABELS) as NoteReason[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={values.reason === r}
                onClick={() => set({ reason: r })}
                className={cn(
                  "control-h rounded-full px-3.5 text-13",
                  values.reason === r
                    ? r === "concept"
                      ? "bg-urgent-bg font-semibold text-urgent-ink"
                      : r === "slip"
                        ? "bg-warn-bg font-semibold text-warn-ink"
                        : "bg-normal-bg font-semibold text-normal-ink"
                    : "bg-surface-2 text-ink-2",
                )}
              >
                {REASON_LABELS[r]}
              </button>
            ))}
          </div>
          {errors.reason ? <p className="text-12 text-urgent-ink">{errors.reason}</p> : null}
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-12 text-sub">메모 (정답, 풀이)</span>
          <textarea
            value={values.memo}
            onChange={(e) => set({ memo: e.target.value })}
            rows={3}
            className="rounded-input bg-surface-2 px-3 py-2 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
          />
          {errors.memo ? <span className="text-12 text-urgent-ink">{errors.memo}</span> : null}
        </label>
      </div>

      {newUnit ? (
        <NameDialog
          title="새 단원"
          label="단원 이름"
          max={40}
          onClose={() => setNewUnit(false)}
          onSubmit={(name) => {
            const id = newId();
            unitMut.insert.mutate({ rows: [{ id, subject_id: values.subject_id, name, sort_order: subjectUnits.length }] });
            set({ unit_id: id });
          }}
        />
      ) : null}
      {newRound ? (
        <RoundDialog
          onClose={() => setNewRound(false)}
          onSubmit={(v) => {
            const id = newId();
            roundMut.insert.mutate({ rows: [{ id, ...v }] });
            set({ mock_round_id: id });
          }}
        />
      ) : null}
    </Dialog>
  );
}

