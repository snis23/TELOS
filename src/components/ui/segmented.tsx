import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
};

/** 여러 개 중 하나 고르기 (예: 라이트 / 다크 / 기기 설정 따르기) */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-input bg-surface-2 p-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "control-h rounded-input px-3 text-13 transition-colors",
              selected ? "bg-surface font-semibold text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
