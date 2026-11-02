"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { isUniqueViolation } from "@/lib/supabase/errors";

/** 10.1 저장 실패: 화면을 되돌린 뒤 "저장하지 못했어요 [다시 시도]" */
export function useSaveErrorToast() {
  const toast = useToast();
  return useCallback(
    (error: unknown, retry?: () => void, messages?: { unique?: string }) => {
      if (messages?.unique && isUniqueViolation(error)) {
        toast.show({ message: messages.unique });
        return;
      }
      toast.show({
        message: "저장하지 못했어요",
        action: retry ? { label: "다시 시도", onClick: retry } : undefined,
      });
    },
    [toast],
  );
}
