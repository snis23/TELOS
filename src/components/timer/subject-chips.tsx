"use client";

import { Segmented } from "@/components/ui/segmented";
import { SubjectDot } from "@/components/ui/subject-dot";
import { cn } from "@/lib/cn";
import { useSubjects } from "@/lib/data/subjects";
import type { SubjectKind, SubjectRow } from "@/lib/supabase/database.types";
import { GROUP_LABELS, subjectsInGroup, useSubjectGroup } from "@/lib/timer/subject-group";

const GROUPS = (["mock", "school"] as const).map((g) => ({ value: g, label: GROUP_LABELS[g] }));

/**
 * 과목 고르기: 모의고사 | 내신 전환 + 그 묶음의 과목 칩.
 * 타이머 카드와 집중 모드가 함께 쓴다. extra 로 칩 오른쪽에 오늘 누적 시간 등을 붙인다.
 */
export function SubjectChips({
  selectedId,
  onSelect,
  extra,
  className,
}: {
  selectedId: string | undefined;
  onSelect: (subject: SubjectRow) => void;
  extra?: (subject: SubjectRow) => React.ReactNode;
  className?: string;
}) {
  const { data } = useSubjects();
  const [group, setGroup] = useSubjectGroup();
  const list = subjectsInGroup(data ?? [], group);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Segmented<SubjectKind> label="과목 묶음" value={group} options={GROUPS} onChange={setGroup} className="self-start" />
      <div role="group" aria-label="과목 고르기" className="flex flex-wrap gap-1.5">
        {list.length === 0 ? (
          <p className="py-1 text-12 text-sub">{group === "school" ? "이번 학기 내신 과목이 없어요. 설정에서 추가해요" : "과목이 없어요"}</p>
        ) : (
          list.map((s, i) => {
            const on = s.id === selectedId;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                aria-keyshortcuts={i < 8 ? String(i + 1) : undefined}
                onClick={() => onSelect(s)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-12 touch:h-10",
                  on ? "bg-chip-on text-ink outline-1 -outline-offset-1 outline-chip-on-line" : "bg-chip-off text-ink-2",
                )}
              >
                <SubjectDot color={s.color_key} />
                {s.name}
                {extra?.(s)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
