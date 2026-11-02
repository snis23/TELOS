import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "text" | "danger" | "dashed";

const VARIANTS: Record<Variant, string> = {
  // 주요 버튼: --btn 바탕, 글자 12~13px 500 (3.5)
  primary: "bg-btn text-btn-ink",
  secondary: "bg-surface-2 text-ink",
  // 글자 링크, 되돌리기 같은 텍스트 버튼 (--accent)
  text: "bg-transparent text-accent px-1",
  danger: "bg-urgent-bg text-urgent-ink",
  // 점선 버튼 (--line-2)
  dashed: "bg-transparent text-sub border border-dashed border-line-2",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  pill?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", pill = false, block = false, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "control-h inline-flex items-center justify-center gap-1.5 px-4 text-13 font-medium transition-opacity",
        "disabled:cursor-not-allowed disabled:opacity-50",
        pill ? "rounded-full" : "rounded-input",
        block && "w-full",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
});

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 아이콘만 있는 버튼은 aria-label 이 반드시 있어야 한다 (10.1 접근성) */
  "aria-label": string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "hit inline-flex size-8 shrink-0 items-center justify-center rounded-input text-sub transition-colors",
        "hover:bg-surface-2 hover:text-ink disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
