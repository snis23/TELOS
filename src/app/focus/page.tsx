import type { Metadata } from "next";
import { FocusView } from "@/components/focus/focus-view";
import { TimerProvider } from "@/components/timer/timer-provider";

export const metadata: Metadata = { title: "집중 모드" };

export default function FocusPage() {
  return (
    <TimerProvider>
      <FocusView />
    </TimerProvider>
  );
}
