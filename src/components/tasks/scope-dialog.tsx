"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Scope } from "./use-task-actions";

/** 반복 할 일을 고치거나 지울 때: "이번만" / "앞으로 모두" */
export function ScopeDialog({
  open,
  action,
  onChoose,
  onClose,
}: {
  open: boolean;
  action: "edit" | "delete";
  onChoose: (scope: Scope) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={action === "edit" ? "반복 할 일 수정" : "반복 할 일 삭제"}
      footer={
        <>
          <Button variant="secondary" onClick={() => onChoose("this")}>
            이번만
          </Button>
          <Button variant={action === "delete" ? "danger" : "primary"} onClick={() => onChoose("all")}>
            앞으로 모두
          </Button>
        </>
      }
    >
      <p className="text-13 text-ink-2">
        {action === "edit" ? "이번 할 일만 바꿀까요, 앞으로 반복도 모두 바꿀까요?" : "이번 할 일만 지울까요, 앞으로 반복도 모두 지울까요?"}
      </p>
    </Dialog>
  );
}
