"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** 4.2 알림: 화면 아래 작은 알림 4초. 저장 실패나 되돌리기에 쓴다. */
export const TOAST_DURATION_MS = 4000;

export type ToastAction = { label: string; onClick: () => void };
export type ToastInput = { message: string; action?: ToastAction };
type ToastItem = ToastInput & { id: number };

type ToastApi = {
  show: (toast: ToastInput) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((input: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    const id = nextId.current++;
    setToast({ ...input, id });
    timer.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className={cn(
          "toast-offset pointer-events-none fixed inset-x-0 z-50 flex justify-center px-5",
        )}
        role="status"
        aria-live="polite"
      >
        {toast ? (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-dialog items-center gap-4 rounded-input bg-timer-bg px-4 py-2.5 text-13 text-ink"
          >
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="hit shrink-0 font-medium text-accent"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss();
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
