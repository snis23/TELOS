import type { SubjectColorKey } from "@/lib/design/subject-colors";
import { cn } from "@/lib/cn";

/** 과목 태그 (3.5): 높이 22px(폰 18px), 모서리 6px, 글자 11px. 과목 태그 바탕·글자색 */
export function SubjectTag({ name, color, className }: { name: string; color: SubjectColorKey; className?: string }) {
  return (
    <span
      data-subject={color}
      className={cn(
        "inline-flex h-tag-phone shrink-0 items-center rounded-tag bg-s-tag px-1.5 text-11 font-medium text-s-tag-ink pad:h-tag pad:px-2",
        className,
      )}
    >
      {name}
    </span>
  );
}

type Tone = "urgent" | "warn" | "normal" | "ok" | "accent" | "muted";
const TONES: Record<Tone, string> = {
  urgent: "bg-urgent-bg text-urgent-ink",
  warn: "bg-warn-bg text-warn-ink",
  normal: "bg-normal-bg text-normal-ink",
  ok: "bg-ok-soft text-ok-ink",
  accent: "bg-nav-on text-accent-strong",
  muted: "bg-surface-2 text-ink-2",
};

/** 상태 표시 태그 (틀린 이유, 상태 칩 등) */
export function Badge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-tag-phone shrink-0 items-center rounded-tag px-1.5 text-11 font-medium pad:h-tag pad:px-2", TONES[tone], className)}>
      {children}
    </span>
  );
}
