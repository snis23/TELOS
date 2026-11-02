"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { SubjectDot } from "@/components/ui/subject-dot";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { newId } from "@/lib/data/crud";
import { useProfile, useUpdateProfile } from "@/lib/data/profile";
import { subjectsKey, useAllSubjects, useSubjectMutations } from "@/lib/data/subjects";
import { useToday } from "@/lib/data/today";
import { pickNextColor } from "@/lib/design/subject-colors";
import { activeSchoolSubjects, termLabel, termOf } from "@/lib/subjects/subjects";
import { SUBJECT_NAME_MAX } from "@/lib/validation/subject";

/**
 * 새 학기 내신 과목 정리 (학기마다 한 번, 설정 > 과목 관리 > 학기 정리 로도 연다).
 * 지난 학기 과목은 계속 들을지 고르고(안 들으면 보관), 이번 학기 과목을 추가한다.
 * 보관한 과목의 기록은 그대로 남는다.
 */
export function TermReviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <TermReviewBody onClose={onClose} />;
}

function TermReviewBody({ onClose }: { onClose: () => void }) {
  const today = useToday();
  const toast = useToast();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: all } = useAllSubjects();
  const { insert, update } = useSubjectMutations();

  const dates = { sem1_start: profile?.sem1_start ?? "03-01", sem2_start: profile?.sem2_start ?? "08-01" };
  const schoolYear = termOf(today, dates, null).schoolYear;
  const [entryYear, setEntryYear] = useState<number>(profile?.entry_year ?? schoolYear);
  const term = termOf(today, dates, entryYear);

  const current = activeSchoolSubjects(all ?? []);
  const [keep, setKeep] = useState<Record<string, boolean>>(() => Object.fromEntries(current.map((s) => [s.id, true])));
  const [newNames, setNewNames] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const taken = new Set([...current.filter((s) => keep[s.id] !== false).map((s) => s.name), ...newNames]);
  const addDraft = () => {
    const name = draft.trim();
    if (!name) return;
    if (name.length > SUBJECT_NAME_MAX) return setError(`${SUBJECT_NAME_MAX}자 이내로 써 주세요`);
    if (taken.has(name)) return setError("이미 있는 과목이에요");
    setNewNames((list) => [...list, name]);
    setDraft("");
    setError(null);
  };

  const save = () => {
    const archiveIds = current.filter((s) => keep[s.id] === false).map((s) => s.id);
    if (archiveIds.length) update.mutate({ ids: archiveIds, patch: { archived_at: new Date().toISOString() } });
    if (newNames.length) {
      const colors = current.filter((s) => keep[s.id] !== false).map((s) => s.color_key);
      const base = (all ?? []).length;
      insert.mutate({
        rows: newNames.map((name, i) => {
          const color_key = pickNextColor(colors);
          colors.push(color_key);
          return { id: newId(), name, color_key, kind: "school" as const, term: term.key, sort_order: base + i };
        }),
        appendTo: subjectsKey,
      });
    }
    updateProfile.mutate({ entry_year: entryYear, reviewed_term: term.key });
    toast.show({ message: `${termLabel(term.key) || "이번 학기"} 내신 과목을 정리했어요` });
    onClose();
  };

  const years = [schoolYear - 2, schoolYear - 1, schoolYear];

  return (
    <Dialog
      open
      onClose={onClose}
      title="새 학기 내신 과목 정리"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            나중에
          </Button>
          <Button onClick={save} disabled={term.key == null}>
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <SelectField
          label="입학 연도"
          value={String(entryYear)}
          onChange={(v) => setEntryYear(Number(v))}
          options={years.map((y) => ({ value: String(y), label: `${y}년 입학 (지금 ${schoolYear - y + 1}학년)` }))}
        />
        <p className="text-13 text-ink-2">
          이번 학기: <strong className="font-medium">{termLabel(term.key) || "학년을 계산할 수 없어요"}</strong>
        </p>

        {current.length > 0 ? (
          <section aria-label="지금 내신 과목">
            <h3 className="mb-1 text-12 text-sub">이번 학기에도 듣는 과목만 체크해 두세요. 체크를 풀면 보관돼요 (기록은 남아요).</h3>
            <div className="flex flex-col">
              {current.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-2 border-b border-line last:border-b-0">
                  <Checkbox
                    checked={keep[s.id] !== false}
                    onChange={(v) => setKeep((k) => ({ ...k, [s.id]: v }))}
                    label={`${s.name} 계속 듣기`}
                  />
                  <SubjectDot color={s.color_key} />
                  <span className="flex-1 text-14 text-ink-2">{s.name}</span>
                  <span className="text-12 text-sub">{keep[s.id] !== false ? "계속" : "보관"}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="새 내신 과목">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addDraft();
            }}
          >
            <TextField
              className="flex-1"
              label="이번 학기 새 과목"
              placeholder="예: 문학, 대수, 화학Ⅰ"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              error={error ?? undefined}
            />
            <Button type="submit" variant="secondary">
              추가
            </Button>
          </form>
          {newNames.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="추가할 과목">
              {newNames.map((name) => (
                <li key={name} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-3 pr-1 text-13 text-ink-2">
                  {name}
                  <IconButton aria-label={`${name} 빼기`} onClick={() => setNewNames((list) => list.filter((n) => n !== name))}>
                    <X size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </Dialog>
  );
}
