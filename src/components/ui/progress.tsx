import { cn } from "@/lib/cn";

/** 진행 막대 (3.5): 높이 3px, 완전히 둥글게. 바탕 --surface-2, 채움 --accent-dot (또는 과목 색) */
export function ProgressBar({
  value,
  label,
  className,
  tone = "accent",
  track = "surface",
}: {
  /** 0~1 */
  value: number;
  label: string;
  className?: string;
  tone?: "accent" | "subject" | "urgent" | "warn" | "normal";
  track?: "surface" | "urgent" | "warn" | "normal";
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = {
    accent: "bg-accent-dot",
    subject: "bg-s-dot",
    urgent: "bg-urgent-ink",
    warn: "bg-warn-ink",
    normal: "bg-normal-ink",
  }[tone];
  const bg = { surface: "bg-surface-2", urgent: "bg-urgent-bar", warn: "bg-warn-bar", normal: "bg-normal-bar" }[track];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-bar w-full overflow-hidden rounded-full", bg, className)}
    >
      <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
