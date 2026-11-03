import type { Metadata } from "next";
import { ExamView } from "@/components/exam/exam-view";

export const metadata: Metadata = { title: "스케줄" };

export default function ExamPage() {
  return <ExamView />;
}
