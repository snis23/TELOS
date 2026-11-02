"use client";

import { useRouter } from "next/navigation";
import { useSubjects } from "@/lib/data/subjects";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { useTimerContext } from "./timer-provider";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ code: `Digit${n}` }));

/** 4.3 Space 타이머, 1~8 과목 전환, N 쪽잠, F 집중 모드 */
export function TimerShortcuts({ inFocus = false }: { inFocus?: boolean }) {
  const router = useRouter();
  const timer = useTimerContext();
  const { data: subjects } = useSubjects();
  useShortcut({ code: "Space" }, () => timer.toggle());
  useShortcut(DIGITS, (_e, i) => {
    const s = subjects?.[i];
    if (s) timer.selectSubject(s.id);
  });
  useShortcut({ code: "KeyN" }, () => timer.toggleNap());
  useShortcut({ code: "KeyF" }, () => router.push("/focus/"), { enabled: !inFocus });
  return null;
}
