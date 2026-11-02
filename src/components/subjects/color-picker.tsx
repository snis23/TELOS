import { cn } from "@/lib/cn";
import { SUBJECT_COLOR_KEYS, SUBJECT_COLOR_LABELS, type SubjectColorKey } from "@/lib/design/subject-colors";

/** 3.3 과목 색 8가지 중 하나 고르기 */
export function ColorPicker({ value, onChange }: { value: SubjectColorKey; onChange: (key: SubjectColorKey) => void }) {
  return (
    <div role="radiogroup" aria-label="과목 색" className="flex flex-wrap gap-2">
      {SUBJECT_COLOR_KEYS.map((key) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={SUBJECT_COLOR_LABELS[key]}
            data-subject={key}
            onClick={() => onChange(key)}
            className="hit inline-flex size-9 items-center justify-center rounded-full"
          >
            <span
              className={cn(
                "size-6 rounded-full bg-s-dot transition-[outline]",
                selected && "outline-2 outline-offset-2 outline-ink",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
