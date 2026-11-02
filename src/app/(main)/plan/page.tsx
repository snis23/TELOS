import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "계획" };

export default function PlanPage() {
  return <ComingSoon title="계획" />;
}
