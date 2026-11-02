"use client";

import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { useProfile, useTerm, useUpdateProfile, type ProfilePatch } from "@/lib/data/profile";
import { useToday } from "@/lib/data/today";
import { termLabel, termOf } from "@/lib/subjects/subjects";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const pad = (n: number) => String(n).padStart(2, "0");

function MonthDay({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [m, d] = value.split("-").map(Number);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-12 text-sub">{label}</legend>
      <div className="flex gap-1">
        <SelectField hideLabel label={`${label} 월`} value={String(m)} onChange={(v) => onChange(`${pad(Number(v))}-${pad(d)}`)} options={MONTHS.map((x) => ({ value: String(x), label: `${x}월` }))} />
        <SelectField hideLabel label={`${label} 일`} value={String(d)} onChange={(v) => onChange(`${pad(m)}-${pad(Number(v))}`)} options={DAYS.map((x) => ({ value: String(x), label: `${x}일` }))} />
      </div>
    </fieldset>
  );
}

/** 6.1 입학 연도와 학기 기간 (학년·학기 계산, 새 학기 내신 과목 정리에 쓴다) */
export function PlanSettings() {
  const today = useToday();
  const term = useTerm(today);
  const { data: p } = useProfile();
  const updateProfile = useUpdateProfile();
  if (!p) return null;
  const set = (patch: ProfilePatch) => updateProfile.mutate(patch);
  const schoolYear = termOf(today, p, null).schoolYear;
  const years = [schoolYear - 3, schoolYear - 2, schoolYear - 1, schoolYear];
  return (
    <Card title="학년과 학기">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="입학 연도"
            value={p.entry_year == null ? "" : String(p.entry_year)}
            onChange={(v) => set({ entry_year: v ? Number(v) : null })}
            options={[{ value: "", label: "정하지 않음" }, ...years.map((y) => ({ value: String(y), label: `${y}년` }))]}
          />
          <p className="pb-2 text-13 text-ink-2">{term.key ? `지금 ${termLabel(term.key)}` : "입학 연도를 정하면 학년을 계산해요"}</p>
        </div>
        <div className="grid gap-4 pad:grid-cols-2">
          <div className="flex flex-wrap gap-3">
            <MonthDay label="1학기 시작" value={p.sem1_start} onChange={(v) => set({ sem1_start: v })} />
            <MonthDay label="1학기 끝" value={p.sem1_end} onChange={(v) => set({ sem1_end: v })} />
          </div>
          <div className="flex flex-wrap gap-3">
            <MonthDay label="2학기 시작" value={p.sem2_start} onChange={(v) => set({ sem2_start: v })} />
            <MonthDay label="2학기 끝 (다음 해)" value={p.sem2_end} onChange={(v) => set({ sem2_end: v })} />
          </div>
        </div>
        <p className="text-12 text-sub">2월 29일은 그해 2월 말일로 읽어요. 새 학기 시작일이 지나면 오늘 화면에서 내신 과목 정리를 물어봐요.</p>
      </div>
    </Card>
  );
}
