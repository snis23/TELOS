import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { cn } from "@/lib/cn";

type Option = { value: string; label: string };

export type SelectFieldProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  label: string;
  hideLabel?: boolean;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

/** 선택 상자: 입력칸과 같은 모양 (--surface-2, 모서리 10px, 13px) */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hideLabel, options, value, onChange, error, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={selectId} className={cn("text-12 text-sub", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="control-h w-full appearance-none rounded-input bg-surface-2 pr-8 pl-3 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={ICON_SIZE.inline}
          strokeWidth={ICON_STROKE}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sub"
        />
      </div>
      {error ? <p className="text-12 text-urgent-ink">{error}</p> : null}
    </div>
  );
});
