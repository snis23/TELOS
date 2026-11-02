import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "학습" };

export default function LearnPage() {
  return <ComingSoon title="학습" />;
}
