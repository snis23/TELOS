import { cn } from "@/lib/cn";

/** 불러오는 중: 카드 모양 그대로 회색 자리 표시 (4.2) */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-input bg-surface-2 motion-safe:animate-pulse", className)} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
