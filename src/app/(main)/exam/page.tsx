import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "시험" };

export default function ExamPage() {
  return <ComingSoon title="시험" />;
}
