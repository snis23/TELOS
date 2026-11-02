import type { Metadata } from "next";
import { LearnView } from "@/components/learn/learn-view";

export const metadata: Metadata = { title: "학습" };

export default function LearnPage() {
  return <LearnView />;
}
