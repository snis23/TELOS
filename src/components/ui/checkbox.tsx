import { Check } from "lucide-react";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { cn } from "@/lib/cn";

/** 체크박스 (5.6): 17px, --check */
export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("hit inline-flex shrink-0 items-center justify-center", className)}
    >
      <span
        className={cn(
          "inline-flex size-check items-center justify-center rounded-key border-2 border-check transition-colors",
          checked && "bg-check",
        )}
      >
        {checked ? <Check size={ICON_SIZE.pin} strokeWidth={ICON_STROKE + 1} className="text-surface" aria-hidden /> : null}
      </span>
    </button>
  );
}
