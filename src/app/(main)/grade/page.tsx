import type { Metadata } from "next";
import { GradeView } from "@/components/grade/grade-view";

export const metadata: Metadata = { title: "성적" };

export default function GradePage() {
  return <GradeView />;
}
