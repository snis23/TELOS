import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "기록" };

export default function RecordPage() {
  return <ComingSoon title="기록" />;
}
