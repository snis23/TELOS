import type { SubjectColorKey } from "@/lib/design/subject-colors";
import { cn } from "@/lib/cn";

/** 과목 점 (지름 7px, 3.5) */
export function SubjectDot({ color, className }: { color: SubjectColorKey; className?: string }) {
  return <span aria-hidden data-subject={color} className={cn("inline-block size-chip-dot shrink-0 rounded-full bg-s-dot", className)} />;
}
