import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/**
 * 입력칸 (3.5): 높이 38px(마우스) / 44px(터치), 테두리 없음, --surface-2 바탕, 모서리 10px, 글자 13px.
 * 잘못된 값은 바로 아래에 12px 긴급 글자색으로 이유를 쓴다 (10.1).
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-12 text-sub">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className="control-h w-full rounded-input bg-surface-2 px-3 text-13 text-ink outline-none focus-visible:outline-2 focus-visible:outline-check"
        {...props}
      />
      {error ? (
        <p id={messageId} className="text-12 text-urgent-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-12 text-sub">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
