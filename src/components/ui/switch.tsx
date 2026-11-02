import { cn } from "@/lib/cn";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
};

/** 스위치: 꺼짐 --line-2, 켜짐 --check */
export function Switch({ checked, onChange, label, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("hit inline-flex shrink-0 items-center justify-center", className)}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-check" : "bg-line-2",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 size-4 rounded-full bg-surface transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}
