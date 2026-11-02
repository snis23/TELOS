"use client";

import { cn } from "@/lib/cn";
import { useSyncState, type SyncState } from "@/lib/use-online";

const LABEL: Record<SyncState, string> = {
  synced: "동기화됨",
  saving: "저장 중",
  offline: "연결 끊김",
};

const DOT: Record<SyncState, string> = {
  synced: "bg-ok-ink",
  saving: "bg-check",
  offline: "bg-urgent-ink",
};

export function SyncStatus({ compact }: { compact?: boolean }) {
  const state = useSyncState();
  return (
    <div className="flex items-center gap-2 text-12 text-sub" role="status" aria-label={LABEL[state]} title={LABEL[state]}>
      <span aria-hidden className={cn("size-dot shrink-0 rounded-full", DOT[state])} />
      <span className={cn(compact && "sr-only")}>{LABEL[state]}</span>
    </div>
  );
}
