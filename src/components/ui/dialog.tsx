"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { ICON_SIZE, ICON_STROKE } from "@/lib/design/icons";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** auto: 폰은 시트, 패드·PC 는 가운데 창 / sheet: 늘 아래 시트 */
  variant?: "auto" | "sheet";
  /** 제목을 화면에서 숨기고 읽기용으로만 둔다 */
  hideTitle?: boolean;
  className?: string;
};

/**
 * 입력 창 (4.2). 브라우저 기본 <dialog> 로 포커스 가두기와 Esc 닫기를 쓴다.
 * 열려 있으면 단축키가 동작하지 않는다 (4.3).
 */
export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return <DialogInner {...props} />;
}

function DialogInner({ onClose, title, children, footer, variant = "auto", hideTitle, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      previous?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-modal="true"
      className={cn(variant === "sheet" ? "dialog-sheet" : "dialog-panel", className)}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onClick={(event) => {
        // 바깥(막)을 누르면 닫는다
        if (event.target === ref.current) onCloseRef.current();
      }}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className={cn("flex items-center justify-between gap-3 px-5 pt-5 pad:px-7 pad:pt-6", hideTitle && "sr-only")}>
          <h2 id={titleId} className="text-14 font-semibold">
            {title}
          </h2>
          <IconButton aria-label="닫기" onClick={() => onCloseRef.current()}>
            <X size={ICON_SIZE.menu} strokeWidth={ICON_STROKE} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pad:px-7">{children}</div>
        {footer ? (
          <footer className="pb-safe flex flex-wrap justify-end gap-2 px-5 pt-1 pb-5 pad:px-7 pad:pb-6">{footer}</footer>
        ) : (
          <div className="pb-safe pb-2" />
        )}
      </div>
    </dialog>
  );
}

/** 확인 창: 범위가 큰 삭제 등 한 번 더 묻는다 (10.1) */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="control-h rounded-input bg-surface-2 px-4 text-13 font-medium text-ink" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={cn(
              "control-h rounded-input px-4 text-13 font-medium",
              danger ? "bg-urgent-bg text-urgent-ink" : "bg-btn text-btn-ink",
            )}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-13 text-ink-2">{message}</div>
    </Dialog>
  );
}
