"use client";

import { useSyncExternalStore } from "react";
import { onlineManager, useIsMutating } from "@tanstack/react-query";

export function useOnline(): boolean {
  return useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export type SyncState = "synced" | "saving" | "offline";

/** 사이드바의 동기화 상태 점 */
export function useSyncState(): SyncState {
  const online = useOnline();
  const mutating = useIsMutating();
  if (!online) return "offline";
  return mutating > 0 ? "saving" : "synced";
}
