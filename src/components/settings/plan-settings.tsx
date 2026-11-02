"use client";

import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useProfile, useUpdateProfile, type ProfilePatch } from "@/lib/data/profile";

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

/** 6.1 학기 기간, 5.6 시험 범위에서 온 할 일 켜고 끄기 */
export function PlanSettings() {
  const { data: p } = useProfile();
  const updateProfile = useUpdateProfile();
  if (!p) return null;
  const set = (patch: ProfilePatch) => updateProfile.mutate(patch);
  return (
    <Card title="학기와 시험 범위">
      <div className="flex flex-col gap-5">
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
        <p className="text-12 text-sub">2월 29일은 그해 2월 말일로 읽어요.</p>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-13 text-ink-2">시험 범위 분배를 날마다 할 일로 만들기</span>
          <Switch checked={p.auto_range_tasks} onChange={(v) => set({ auto_range_tasks: v })} label="시험 범위 할 일 자동 만들기" />
        </div>
      </div>
    </Card>
  );
}
